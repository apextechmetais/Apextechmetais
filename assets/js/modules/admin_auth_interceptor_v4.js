/**
 * Interceptor Global de Autenticação e Caching (State Management)
 * Faz o "Monkey Patch" do window.fetch nativo para injetar JWT e criar cache em memória.
 */
(function() {
    const originalFetch = window.fetch;

    // Cache Global State Manager
    window.ApexCache = {
        ttl: 60000, // 60 segundos padrão
        data: new Map(), // { [url]: { time: Date.now(), body: string, contentType: string } }
        promises: new Map(), // Para desduplicação de chamadas simultâneas
        
        clear: function(prefix = null) {
            if (!prefix) {
                this.data.clear();
                this.promises.clear();
                console.log('[ApexCache] Cache global limpo.');
            } else {
                for (let key of this.data.keys()) {
                    if (key.startsWith(prefix)) this.data.delete(key);
                }
                for (let key of this.promises.keys()) {
                    if (key.startsWith(prefix)) this.promises.delete(key);
                }
                console.log(`[ApexCache] Cache limpo para o prefixo: ${prefix}`);
            }
        }
    };

    window.fetch = async function() {
        let [resource, config] = arguments;
        
        let argsToPass = arguments;

        // Só interceptamos se for string e começar com /api/
        if (typeof resource === 'string' && resource.startsWith('/api/') && resource !== '/api/login') {
            config = config || {};
            const method = (config.method || 'GET').toUpperCase();
            
            // 1. Injeção de JWT
            let headersObj = {};
            if (config.headers) {
                // Clona os headers existentes caso seja Headers ou objeto
                if (config.headers instanceof Headers) {
                    config.headers.forEach((value, key) => { headersObj[key] = value; });
                } else {
                    headersObj = { ...config.headers };
                }
            }
            
            const token = localStorage.getItem('apex_token');
            if (token) {
                headersObj['Authorization'] = 'Bearer ' + token;
            }
            config.headers = headersObj;
            
            argsToPass = [resource, config];

            // 2. Lógica de Invalidação de Cache (POST, PUT, DELETE, PATCH)
            if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
                // Invalida o prefixo da rota para garantir que o próximo GET traga dados atualizados
                // Ex: /api/amostras/1 -> invalida /api/amostras
                const segments = resource.split('/');
                const prefix = segments.slice(0, 3).join('/'); // /api/amostras
                window.ApexCache.clear(prefix);
            }

            // 3. Lógica de Leitura do Cache (Apenas GET sem no-store explícito)
            const isImageRoute = resource.match(/\/(img|fotos|pdf|download)$/i);
            if (method === 'GET' && (!config.cache || config.cache !== 'no-store') && !isImageRoute) {
                const cacheKey = resource;
                
                // Retorna resposta do cache se válida
                if (window.ApexCache.data.has(cacheKey)) {
                    const cached = window.ApexCache.data.get(cacheKey);
                    if (Date.now() - cached.time < window.ApexCache.ttl) {
                        console.log(`[ApexCache] HIT: ${cacheKey}`);
                        return new Response(cached.body, { 
                            status: 200, 
                            headers: { 'Content-Type': cached.contentType }
                        });
                    } else {
                        window.ApexCache.data.delete(cacheKey); // Expirou
                    }
                }

                // Desduplicação de chamadas simultâneas (Previne múltiplos requests idênticos)
                if (window.ApexCache.promises.has(cacheKey)) {
                    console.log(`[ApexCache] DEDUP: ${cacheKey}`);
                    const cachedBodyObj = await window.ApexCache.promises.get(cacheKey);
                    return new Response(cachedBodyObj.body, { 
                        status: cachedBodyObj.status, 
                        statusText: cachedBodyObj.statusText,
                        headers: { 'Content-Type': cachedBodyObj.contentType }
                    });
                }

                // Faz o fetch real e guarda a Promise
                const fetchPromise = originalFetch.apply(this, argsToPass).then(async response => {
                    const clone = response.clone();
                    const body = await clone.text();
                    const contentType = response.headers.get('Content-Type') || 'application/json';
                    const cacheObj = { 
                        time: Date.now(), 
                        body, 
                        contentType, 
                        status: response.status, 
                        statusText: response.statusText 
                    };

                    if (response.ok) {
                        window.ApexCache.data.set(cacheKey, cacheObj);
                    }
                    
                    // Mantemos o DEDUP apenas enquanto a requisição está pendente
                    setTimeout(() => window.ApexCache.promises.delete(cacheKey), 50);
                    return cacheObj;
                }).catch(err => {
                    window.ApexCache.promises.delete(cacheKey);
                    throw err;
                });

                window.ApexCache.promises.set(cacheKey, fetchPromise);
                
                try {
                    const cacheObj = await fetchPromise;
                    const resFinal = new Response(cacheObj.body, { 
                        status: cacheObj.status, 
                        statusText: cacheObj.statusText,
                        headers: { 'Content-Type': cacheObj.contentType }
                    });
                    if (resFinal.status >= 400) {
                        return handleAuthErrors(resFinal, resource);
                    }
                    return resFinal;
                } catch (responseOrError) {
                    if (responseOrError && responseOrError.status) {
                        return handleAuthErrors(responseOrError, resource);
                    }
                    throw responseOrError;
                }
            }
        }
        
        // Comportamento normal para não-cacheados ou origens externas
        const response = await originalFetch.apply(this, argsToPass);
        return handleAuthErrors(response, resource);
    };

    function handleAuthErrors(response, resource) {
        if (response.status === 401) {
            console.error('Sessão expirada ou acesso negado (401).');
            if (resource !== '/api/login') {
                localStorage.removeItem('apex_token');
                sessionStorage.removeItem('apex_admin_logged_in');
                window.location.reload();
            }
        }
        if (response.status === 403) {
            console.warn('Acesso Negado (403): O seu perfil não tem permissão para acessar este recurso.');
            if (window._apexNotify) {
                window._apexNotify('Acesso Negado', 'Seu perfil não possui permissão para acessar estes dados.', 'error');
            }
        }
        return response;
    }
})();
