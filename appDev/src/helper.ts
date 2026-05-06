import {WBK, type EntityId, type Props, type SimplifiedItem } from 'wikibase-sdk';

export const wbk = WBK({
  instance: 'https://www.wikidata.org',
  sparqlEndpoint: 'https://query.wikidata.org/sparql',
  // A custom user agent is recommended to use `wbk.client` functions, see https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy
  userAgent: 'GraphProject/1.0 (https://jebcui.com/GraphProject/; GraphProject@jebcui.com)',
});


export interface entitiesCache {
    [key: string]: {
        data: SimplifiedItem,
        timestamp: number,
    };
}

export const getEntities = async(ids: string[], props?: string[]): Promise<{[key: string]: SimplifiedItem}> => {
    // Check localStorage
    const entitiesString = localStorage.getItem('entities');
    let entities: entitiesCache;
    let output: {[key: string]: SimplifiedItem} = {};
    // Load any valid cached data
    if (entitiesString) {
        entities = JSON.parse(entitiesString) as entitiesCache;
        for (const id of ids) {
            if (entities?.[id] && entities[id].timestamp && (Date.now() - entities[id].timestamp < 24 * 60 * 60 * 1000)) {
                output[id] = entities[id].data;
            }
        }
    } else {
        entities = {};
    }
    // Fetch from API
    const labelUrl = wbk.getEntities({
        ids: ids as EntityId[],
        props: props as Props[] | undefined,
    })

    const labelData = await fetch(labelUrl).then(res => res.json());
    for (const id of ids) {
        const entity = wbk.simplify.entity(labelData.entities[id], {
        timeConverter: "simple-day"
    });
        output[id] = entity;
        entities[id] = {
            data: entity,
            timestamp: Date.now()
        };
    }
    // Save new data to localStorage
    localStorage.setItem('entities', JSON.stringify(entities));
    return output;
}