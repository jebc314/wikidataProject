import Graph from "graphology";
import Sigma from "sigma";
// import FA2Layout from "graphology-layout-forceatlas2/worker";
import forceAtlas2 from "graphology-layout-forceatlas2";
import noverlap from "graphology-layout-noverlap";
import type { Coordinates, EdgeDisplayData, NodeDisplayData } from "sigma/types";
import { simplifySparqlResults } from 'wikibase-sdk'
import languagesJson from './assets/languages.json';
import { wbk, getEntities } from './helper';

import graphDataJson from './assets/graphData.json';
import LGBTQAsianJson from './assets/LGBTQAsian.json';

/**
 * Add listener for closing the info panel
 */

document.getElementById("close-info")!.addEventListener("click", () => {
    const infoPanel = document.getElementById("info-panel")!;
    const infoFrame = document.getElementById("info-frame") as HTMLIFrameElement;
    infoPanel.hidden = true;
    infoFrame.src = "";
});

/**
 * Fetch list of Category:American LGBTQ people of Asian descent
 */

let LGBTQAsians: Set<string> = new Set();

const url = wbk.sparqlQuery(`
    SELECT * WHERE {
  SERVICE wikibase:mwapi {
     bd:serviceParam wikibase:endpoint "en.wikipedia.org";
                     wikibase:api "Generator";
                     mwapi:generator "categorymembers";
                     mwapi:gcmtitle "Category:American LGBTQ people of Asian descent";
                     mwapi:gcmprop "ids|title|type";
                     mwapi:gcmlimit "max".
     ?item wikibase:apiOutputItem mwapi:item.
  }
}`);

const LGBTQAsianCache = localStorage.getItem('LGBTQAsian');
if (LGBTQAsianCache) {
    const LGBTQAsianData = JSON.parse(LGBTQAsianCache);
    if (LGBTQAsianData.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000) { // Cache for a week
        for (const item of LGBTQAsianData.data) {
            LGBTQAsians.add(item.item);
        }
    }
} else {
    if (LGBTQAsianJson.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000) {
        localStorage.setItem('LGBTQAsian', JSON.stringify(LGBTQAsianJson));
        for (const item of LGBTQAsianJson.data) {
            LGBTQAsians.add(item.item);
        }
    } else {
    fetch(url)
        .then(res => res.json())
        .then(data => {
            const simplifiedResults = simplifySparqlResults(data);
            localStorage.setItem('LGBTQAsian', JSON.stringify({
                data: simplifiedResults,
                timestamp: Date.now(),
            }));
            for (const item of simplifiedResults) {
                LGBTQAsians.add((item as unknown as { item: string }).item);
            }
        });
    }
}

/**
 * Fetch data.
 */

const languages = languagesJson.query.languages;
console.log(languages);
const languageSelect = document.querySelector<HTMLSelectElement>('#language')!;
languages.forEach((lang: any) => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang["*"];
    option.selected = lang.code === 'en';
    languageSelect.appendChild(option);
});

languageSelect.addEventListener('change', async (event) => {
    const selectedLanguage = (event.target as HTMLSelectElement).value;
    const graphData = await loadGraphData(selectedLanguage);
    updateGraph(graphData, graph, selectedLanguage);
    searchSuggestions.innerHTML = graph
        .nodes()
        .map((node) => `<option value="${graph.getNodeAttribute(node, "label")}"></option>`)
        .join("\n");
    sigma.scheduleRefresh();
});

const loadGraphData = async (language: string = 'en') => {
    const query = `
        SELECT ?item ?itemLabel
        (GROUP_CONCAT(DISTINCT ?gender; separator=",") AS ?genders)
        WHERE
        {
        {
            ?item p:P19 ?statement0.
            ?statement0 (ps:P19/(wdt:P279*)) wd:Q30.
        }
        UNION
        {
            ?item p:P27 ?statement1.
            ?statement1 (ps:P27/(wdt:P279*)) wd:Q30.
        }
        ?item wdt:P106 wd:Q19509201.
        ?item wdt:P21 ?gender.
        SERVICE wikibase:label {
            bd:serviceParam wikibase:language "${language},mul,en".
        } # Helps get the label in your language, if not, then default for all languages, then en language
        } GROUP BY ?item ?itemLabel
    `

    const url = wbk.sparqlQuery(query);

    let storedGraphData = localStorage.getItem('graphData');
    let graphData: any[];
    if (!storedGraphData) {
        const data = await fetch(url).then(res => res.json()).then();
        console.log(data);
        const simplifiedResults = simplifySparqlResults(data);
        console.log(simplifiedResults);
        localStorage.setItem('graphData', JSON.stringify({
                [language]: {
                    data: simplifiedResults,
                    timestamp: Date.now(),
                }
            }));
        graphData = simplifiedResults;
    } else {
        const parsedGraphData = JSON.parse(storedGraphData);
        if((language in parsedGraphData) && parsedGraphData[language].timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000) { // Cache for a week
            graphData = parsedGraphData[language].data;
        } else {
            const data = await fetch(url).then(res => res.json()).then();
            const simplifiedResults = simplifySparqlResults(data);
            parsedGraphData[language] = {
                data: simplifiedResults,
                timestamp: Date.now()
            };
            localStorage.setItem('graphData', JSON.stringify(parsedGraphData));
            graphData = simplifiedResults;
        }
    }
    console.log(graphData);
    return graphData;
}

let storedGraphData = localStorage.getItem('graphData');
if (!storedGraphData) {
    localStorage.setItem('graphData', JSON.stringify(graphDataJson));
}

const graphData = await loadGraphData();

const updateGraph = async (graphData: any, graph: Graph, language: string = 'en') => {
    if (graph.order === 0) {
        const genderToName: Record<string, string[]> = {};

        for (let i = 0; i < graphData.length; i++) {
            if (!graphData[i].genders) continue;
            let genderArray = graphData[i].genders.trim().split(",");
            for (let j = 0; j < genderArray.length; j++) {
                let gender = genderArray[j].trim();
                gender = gender.substring(gender.lastIndexOf('/') + 1);
                if (!genderToName[gender]) {
                    genderToName[gender] = [graphData[i].item.value];
                } else {
                    genderToName[gender].push(graphData[i].item.value);
                }
            }
        }

        graph.addNode("0", { label: "LGBTQ+ Asians in the US", size: 30, color: "red" });

        let count = 0;
        for (let i = 0; i < graphData.length; i++) {
            const id = graphData[i].item.value;
            graph.addNode(id, {
                label: graphData[i].item.label, 
                size: LGBTQAsians.has(id) ? 30 : 10, 
                color: LGBTQAsians.has(id) ? "pink" : "blue", 
                value: graphData[i].item.value,
            });
            if (LGBTQAsians.has(id)) {
                count++;
                graph.addEdge("0", id, { size: 5, color: "red" });
            }
        }
        console.log(`Found ${count} LGBTQ+ Asians Activist in the US`);

        // Fetch labels for the genders
        const genderEntities = await getEntities(Object.keys(genderToName), ['labels']).then();

        for (const gender in genderToName) {
            const genderLabel = genderEntities[gender]?.labels?.[language] || genderEntities[gender]?.labels?.['en'] || ''; 
            graph.addNode(gender, { label: genderLabel, size: 20, color: "blue" });
            const namesForGender = genderToName[gender];
            for (let i = 0; i < namesForGender.length; i++) {
                graph.addEdge(gender, namesForGender[i], { size: 1, color: "red" });
            }
        }

        graph.forEachNode((node) => {
            graph.setNodeAttribute(node, "x", (Math.random() - 0.5) * 10);
            graph.setNodeAttribute(node, "y", (Math.random() - 0.5) * 10);
        });

        /*const layout = new FA2Layout(graph, {
        settings: {
            scalingRatio: 30,
            gravity: 0.3,
            edgeWeightInfluence: 0,
            adjustSizes: true,
            barnesHutOptimize: true,
        },
        });*/
        /*forceAtlas2.assign(graph, {
        iterations: 1000,
        settings: {
            scalingRatio: 40,
            gravity: 0.15,
            edgeWeightInfluence: 0,
            adjustSizes: true,
        },
        });*/

        forceAtlas2.assign(graph, {
            iterations: 3000,
            settings: {
                scalingRatio: 40,
                gravity: 0.3,
                edgeWeightInfluence: 0.5,
                adjustSizes: true,
                //barnesHutOptimize: true,
            },
        });
        noverlap.assign(graph, {
            settings: {
                margin: 40,
            },
        });

        /*layout.start();

        // Optional: stop after stabilization
        setTimeout(() => {
            layout.stop()
            noverlap.assign(graph, {
                settings: {
                    margin: 10,
                },
            });
        }, 5000);*/   
    } else {
        let genders = new Set<string>();
        graphData.forEach((data: any) => {
            if (!graph.hasNode(data.item.value)) {
                graph.addNode(data.item.value, { label: data.item.label, size: 10, color: "blue", value: data.item.value});
            } else {
                graph.setNodeAttribute(data.item.value, "label", data.item.label);
            }
            // Get genders
            let genderArray = data.genders.trim().split(",");
            for (let j = 0; j < genderArray.length; j++) {
                let gender = genderArray[j].trim();
                gender = gender.substring(gender.lastIndexOf('/') + 1);
                genders.add(gender);
            }
        });
        const genderEntities = await getEntities(Array.from(genders), ['labels']).then();
        console.log(genderEntities)
        genders.forEach((gender: string) => {
            const entity = genderEntities[gender];
            const genderLabel = entity.labels?.[language] || entity.labels?.['en'] || '';
            if (!graph.hasNode(gender)) {
                graph.addNode(gender, { label: genderLabel, size: 20, color: "blue" });
            } else {
                graph.setNodeAttribute(gender, "label", genderLabel);
            }
        });
    }
};

/**
 * Creating the graph.
 */

const graph = new Graph();

await updateGraph(graphData, graph);
document.getElementById("overlay")!.style.display = "none";

const sigma = new Sigma(graph, document.getElementById("container")!);

document.getElementById("home")!.addEventListener("click", () => {
    sigma.getCamera().animate(
        { x: 0.5, y: 0.5, ratio: 1 }, 
        { duration: 500 }
    );
});

/**
 * Part for drag'b'drop.
 */

// State for drag'n'drop
let draggedNode: string | null = null;
let isDragging = false;

// On mouse down on a node
//  - we enable the drag mode
//  - save in the dragged node in the state
//  - highlight the node
//  - disable the camera so its state is not updated
sigma.on("downNode", (e) => {
    isDragging = true;
    draggedNode = e.node;
    graph.setNodeAttribute(draggedNode, "highlighted", true);
    if (!sigma.getCustomBBox()) sigma.setCustomBBox(sigma.getBBox());
    });

    // On mouse move, if the drag mode is enabled, we change the position of the draggedNode
    sigma.on("moveBody", ({ event }) => {
    if (!isDragging || !draggedNode) return;

    // Get new position of node
    const pos = sigma.viewportToGraph(event);

    graph.setNodeAttribute(draggedNode, "x", pos.x);
    graph.setNodeAttribute(draggedNode, "y", pos.y);

    // Prevent sigma to move camera:
    event.preventSigmaDefault();
    event.original.preventDefault();
    event.original.stopPropagation();
});

// On mouse up, we reset the dragging mode
const handleUp = () => {
    if (draggedNode) {
        graph.removeNodeAttribute(draggedNode, "highlighted");
    }
    isDragging = false;
    draggedNode = null;
};
sigma.on("upNode", handleUp);
sigma.on("upStage", handleUp);

sigma.getMouseCaptor().on("doubleClick", (e) => {
    e.preventSigmaDefault();
});

sigma.on("doubleClickNode", (e) => {
    console.log("double clicked a node", e.node);
    sigma.getCamera().animate(
        { 
            x: sigma.getNodeDisplayData(e.node)!.x, 
            y: sigma.getNodeDisplayData(e.node)!.y, 
            ratio: 0.1 // Lower ratio = closer zoom
        }, 
        { duration: 500 } // Animation length in ms
    );
    console.log(e.event.x, e.event.y);
    console.log(sigma.getBBox(), sigma.getCamera());
    if (e.node.startsWith("Q")) {
        // window.location.href = `item.html?id=${e.node}`;
        const infoPanel = document.getElementById("info-panel")!;
        infoPanel.hidden = false;
        const infoFrame = document.getElementById("info-frame") as HTMLIFrameElement;
        infoFrame.src = `item.html?id=${e.node}`;
    }
})

/**
 * Enable searching for nodes
 */

// Retrieve some useful DOM elements:
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const searchSuggestions = document.getElementById("suggestions") as HTMLDataListElement;

// Type and declare internal state:
interface State {
    hoveredNode?: string;
    searchQuery: string;

    // State derived from query:
    selectedNode?: string;
    suggestions?: Set<string>;

    // State derived from hovered node:
    hoveredNeighbors?: Set<string>;
}
const state: State = { searchQuery: "" };

// Feed the datalist autocomplete values:
searchSuggestions.innerHTML = graph
    .nodes()
    .map((node) => `<option value="${graph.getNodeAttribute(node, "label")}"></option>`)
    .join("\n");

// Actions:
function setSearchQuery(query: string) {
    state.searchQuery = query;

    if (searchInput.value !== query) searchInput.value = query;

    if (query) {
        const lcQuery = query.toLowerCase();
        const suggestions = graph
        .nodes()
        .map((n) => ({ id: n, label: graph.getNodeAttribute(n, "label") as string }))
        .filter(({ label }) => label.toLowerCase().includes(lcQuery));

        // If we have a single perfect match, them we remove the suggestions, and
        // we consider the user has selected a node through the datalist
        // autocomplete:
        if (suggestions.length === 1 && suggestions[0].label === query) {
        state.selectedNode = suggestions[0].id;
        state.suggestions = undefined;

        // Move the camera to center it on the selected node:
        const nodePosition = sigma.getNodeDisplayData(state.selectedNode) as Coordinates;
        sigma.getCamera().animate(nodePosition, {
            duration: 500,
        });
        }
        // Else, we display the suggestions list:
        else {
        state.selectedNode = undefined;
        state.suggestions = new Set(suggestions.map(({ id }) => id));
        }
    }
    // If the query is empty, then we reset the selectedNode / suggestions state:
    else {
        state.selectedNode = undefined;
        state.suggestions = undefined;
    }

    // Refresh rendering
    // You can directly call `renderer.refresh()`, but if you need performances
    // you can provide some options to the refresh method.
    // In this case, we don't touch the graph data so we can skip its reindexation
    sigma.refresh({
        skipIndexation: true,
    });
}
function setHoveredNode(node?: string) {
if (node) {
    state.hoveredNode = node;
    state.hoveredNeighbors = new Set(graph.neighbors(node));
}

if (!node) {
    state.hoveredNode = undefined;
    state.hoveredNeighbors = undefined;
}

// Refresh rendering
sigma.refresh({
    // We don't touch the graph data so we can skip its reindexation
    skipIndexation: true,
});
}

// Bind search input interactions:
searchInput.addEventListener("input", () => {
    setSearchQuery(searchInput.value || "");
});
searchInput.addEventListener("blur", () => {
    setSearchQuery("");
});

// Bind graph interactions:
sigma.on("enterNode", ({ node }) => {
    setHoveredNode(node);
});
sigma.on("leaveNode", () => {
    setHoveredNode(undefined);
});

// Render nodes accordingly to the internal state:
// 1. If a node is selected, it is highlighted
// 2. If there is query, all non-matching nodes are greyed
// 3. If there is a hovered node, all non-neighbor nodes are greyed
sigma.setSetting("nodeReducer", (node, data) => {
    const res: Partial<NodeDisplayData> = { ...data };

    if (state.hoveredNeighbors && !state.hoveredNeighbors.has(node) && state.hoveredNode !== node) {
        res.label = "";
        res.color = "#f6f6f6";
    }

    if (state.selectedNode === node) {
        res.highlighted = true;
    } else if (state.suggestions) {
        if (state.suggestions.has(node)) {
        res.forceLabel = true;
        } else {
        res.label = "";
        res.color = "#f6f6f6";
        }
    }

    return res;
});

// Render edges accordingly to the internal state:
// 1. If a node is hovered, the edge is hidden if it is not connected to the
//    node
// 2. If there is a query, the edge is only visible if it connects two
//    suggestions
sigma.setSetting("edgeReducer", (edge, data) => {
    const res: Partial<EdgeDisplayData> = { ...data };

    if (
        state.hoveredNode &&
        !graph.extremities(edge).every((n) => n === state.hoveredNode || graph.areNeighbors(n, state.hoveredNode))
    ) {
        res.hidden = true;
    }

    if (
        state.suggestions &&
        (!state.suggestions.has(graph.source(edge)) || !state.suggestions.has(graph.target(edge)))
    ) {
        res.hidden = true;
    }

    return res;
});

import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const driverObj = driver({
  showProgress: true,
  steps: [
    { element: 'body', popover: { title: 'Welcome to the Wikidata Graph Explorer!', description: 'This tour will guide you through the main features of the application.' } },
    { element: '#home', popover: { title: 'Home Button', description: 'You can click this button to reset the graph view at any time.' } },
    { element: '#search-input', popover: { title: 'Search Input', description: 'You can use this input to search for nodes in the graph.' } },
    { element: '#language', popover: { title: 'Language Selector', description: 'You can select the language for the labels in the graph.' } },
    { element: '#container', popover: { title: 'Graph Area', description: 'This is where the graph is displayed. You can double click on nodes to see more information, or drag them around! Asian Americans are highlighted in pink.' } },
    {
        element: '#info-panel',
        popover: { title: 'Info Panel', description: 'When you double click on a node, an info panel will open on the right with more information about the entity.' },
        onHighlightStarted: () => {
            const infoPanel = document.getElementById("info-panel")!;
            const infoFrame = document.getElementById("info-frame") as HTMLIFrameElement;
            infoPanel.hidden = false;
            infoFrame.src = `item.html?id=Q2502233`; // Example
            sigma.getCamera().animate(
                { 
                    x: sigma.getNodeDisplayData("Q2502233")!.x, 
                    y: sigma.getNodeDisplayData("Q2502233")!.y, 
                    ratio: 0.1 // Lower ratio = closer zoom
                }, 
                { duration: 500 } // Animation length in ms
            );
        },
        onDeselected: () => {
            const infoPanel = document.getElementById("info-panel")!;
            infoPanel.hidden = true;
        }
    },
    {
        element: '#close-info',
        popover: { title: 'Close Info Panel', description: 'You can click this button to close the info panel.' },
        onHighlightStarted: () => {
            const infoPanel = document.getElementById("info-panel")!;
            infoPanel.hidden = false;
        },
        onDeselected: () => {
            const infoPanel = document.getElementById("info-panel")!;
            infoPanel.hidden = true;
        }
    },
    {
        element: '#info-frame',
        popover: { title: 'Info Frame', description: 'This frame displays the detailed information about the entity. You can also change the language selection using the dropdown at the bottom.' },
        onHighlightStarted: () => {
            const infoPanel = document.getElementById("info-panel")!;
            infoPanel.hidden = false;
        },
        onDeselected: () => {
            const infoPanel = document.getElementById("info-panel")!;
            infoPanel.hidden = true;
        }
    }
  ],
  onDestroyed: () => {
    const infoPanel = document.getElementById("info-panel")!;
    infoPanel.hidden = true;
    document.getElementById("home")!.click(); // Reset camera view when closing info panel
  }
});

document.getElementById("start-tour")!.addEventListener("click", () => {
    driverObj.drive();
});

// If first time
localStorage.getItem('hasVisited') || driverObj.drive();
localStorage.setItem('hasVisited', 'true');