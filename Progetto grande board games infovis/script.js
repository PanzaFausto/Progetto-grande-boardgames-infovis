// Attende che l'intero contenuto della pagina (DOM) sia stato caricato prima di eseguire lo script.
document.addEventListener('DOMContentLoaded', () => {

    // --- Selettori DOM ---
    const allSliders = document.querySelectorAll('input[type="range"]');
    const resetFiltersBtn = document.getElementById('reset-filters');
    const gameListUL = d3.select("#game-list-ul");
    const legendUL = d3.select("#legend-ul");
    const gameSearch = document.getElementById('game-search');
    const tooltip = d3.select("#tooltip");
    const tooltipDetails = d3.select("#tooltip-details");
    const backgroundAudio = document.getElementById('background-audio');
    const nodeAudio = document.getElementById('node-audio');
    const rankSlider = document.getElementById('rank-slider');
    const ratingSlider = document.getElementById('rating-slider');
    const reviewsSlider = document.getElementById('reviews-slider');
    const playersSlider = document.getElementById('players-slider');
    const minAgeSlider = document.getElementById('minage-slider');
    const playtimeMinSlider = document.getElementById('playtime-min-slider');
    const playtimeMaxSlider = document.getElementById('playtime-max-slider');
	const yearMinSlider = document.getElementById('year-min-slider');
	const yearMaxSlider = document.getElementById('year-max-slider');
	const categorySelect = document.getElementById('category-select');
	const mechanicsCheckboxes = document.getElementById('mechanics-checkboxes');

    // --- Funzioni Splash Screen ---
    function hideSplashAndDraw() {
        const splash = document.getElementById('splash-screen');
        if (!splash || splash.classList.contains('hidden')) return; // Check di sicurezza

        splash.classList.add('hidden');
        
        setTimeout(() => {
            startApp(); // Chiama la funzione che avvia l'app principale
        }, 800); // Delay per far completare l'animazione di fade-out
    }

    // --- Listener Splash Screen ---
    window.addEventListener('click', () => {
        
        // Avvia la scomparsa dello splash
        hideSplashAndDraw();

        // Avvia l'audio di sottofondo con un delay di 1 secondo
        setTimeout(() => {
            if (backgroundAudio) {
                backgroundAudio.volume = 0.3;
                backgroundAudio.play().catch(e => console.log('Errore riproduzione audio di background:', e));
            }
        }, 1700); // Delay di 1 secondo (1000ms)

    }, { once: true });
	
    // --- Variabili Globali ---
    let allData = [], allNodes = [], allLinks = [];
    let chart1, chart2, chart3, chart4, chart5;
    let nodeSelection, linkSelection, labelSelection, linkLabelSelection;
    let svg, g, zoom;
    let gClone;
    let centerX, centerY;
    let isInitialLoad = true;
    let selectedNode = null;

    // --- Scale D3 ---
    const customColors = [
        "#e41a1c", // Rosso
        "#377eb8", // Blu
        "#4daf4a", // Verde
        "#984ea3", // Viola
        "#ff7f00", // Arancione
        "#B8860B", // Ocra Scuro
        "#a65628", // Marrone
        "#f781bf", // Rosa
        "#8dd3c7"  // Verde Acqua
    ];
    const colorScale = d3.scaleOrdinal(customColors);
    const radiusScale = d3.scaleSqrt().range([5, 25]);

	// --- Funzione Audio di Sottofondo ---
    function initializeBackgroundAudio() {
        if (backgroundAudio) {
            backgroundAudio.volume = 0.3; 
        }
    }

    // Riproduce un breve suono quando un nodo viene selezionato.
    function playNodeAudio() {
        if (nodeAudio) {
            nodeAudio.currentTime = 0;
            nodeAudio.volume = 0.5;
            nodeAudio.play().catch(error => console.log('Errore riproduzione audio nodo:', error));
        }
    }

    // --- Inizializzazione Principale ---
    function startApp() {
        fetch('boardgames_100.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Errore HTTP! Stato: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Setup dati
                allData = data;
                initializeBackgroundAudio(); 
                
                allNodes = data.map(game => ({
                    id: game.id, title: game.title, year: game.year, rank: game.rank,
                    rating: game.rating.rating, num_reviews: game.rating.num_of_reviews,
                    minplayers: game.minplayers, maxplayers: game.maxplayers,
                    minplaytime: game.minplaytime, maxplaytime: game.maxplaytime,
                    minage: game.minage,
                    primaryCategory: game.types.categories[0]?.name || "N/A",
                    designers: game.credit.designer.map(d => d.name),
                    mechanics: game.types.mechanics.map(m => m.name),
                    categories: game.types.categories.map(c => c.name)
                }));

                radiusScale.domain(d3.extent(allNodes, d => d.rating));
                
                // Popolamento filtri
                const allCategories = [...new Set(allData.flatMap(g => g.types.categories.map(c => c.name)))].sort();
                allCategories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat;
                    categorySelect.appendChild(option);
                });
                
                const allMechanics = [...new Set(allData.flatMap(g => g.types.mechanics.map(m => m.name)))].sort();
                allMechanics.forEach(mech => {
                    const div = document.createElement('div');
                    const mechId = `mech-${mech.replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`;
                    div.innerHTML = `<input type="checkbox" id="${mechId}" value="${mech}">
                                     <label for="${mechId}" style="font-weight: normal; margin-left: 5px;">${mech}</label>`;
                    mechanicsCheckboxes.appendChild(div);
                });

                const yearExtent = d3.extent(allData, d => d.year);
                yearMinSlider.min = yearExtent[0];
                yearMinSlider.max = yearExtent[1];
                yearMinSlider.value = yearExtent[0];
                yearMaxSlider.min = yearExtent[0];
                yearMaxSlider.max = yearExtent[1];
                yearMaxSlider.value = yearExtent[1];
                document.getElementById('year-value').textContent = `${yearMinSlider.value}-${yearMaxSlider.value}`;
                
                allNodes.forEach(node => {
                    node.r = radiusScale(node.rating);
                });
                
                const reviewsExtent = d3.extent(allNodes, d => d.num_reviews);
                reviewsSlider.min = reviewsExtent[0];
                reviewsSlider.max = reviewsExtent[1];
                reviewsSlider.value = reviewsExtent[0];
                document.getElementById('reviews-value').textContent = reviewsExtent[0];

                // Creazione Links
                const linkSet = new Set();
                data.forEach(game => {
                    if (game.recommendations && game.recommendations.fans_liked) {
                        game.recommendations.fans_liked.forEach(recommendedId => {
                            const sourceGame = allNodes.find(n => n.id === game.id);
                            const targetGame = allNodes.find(n => n.id === recommendedId);
                            
                            if (sourceGame && targetGame && game.id !== recommendedId) {
                                const sourceId = Math.min(game.id, recommendedId);
                                const targetId = Math.max(game.id, recommendedId);
                                const key = `${sourceId}-${targetId}`;
                                
                                if (!linkSet.has(key)) {
                                    allLinks.push({ 
                                        source: allNodes.find(n => n.id === sourceId), 
                                        target: allNodes.find(n => n.id === targetId) 
                                    });
                                    linkSet.add(key);
                                }
                            }
                        });
                    }
                });
                
                // Avvio Visualizzazione
                createStatsCharts(data);
                createRobustnessChart();
                initializeGraph();
                updateGraph(); 

                // Aggiunta Event Listeners
                allSliders.forEach(slider => {
                    // Nota: questo listener gestisce gli slider singoli
                    // Quelli doppi (anno, tempo) sono gestiti da listener specifici più avanti
                    slider.addEventListener('input', () => {
                        const span = document.getElementById(`${slider.id.split('-')[0]}-value`);
                        if (span && !span.id.includes('year-value') && !span.id.includes('playtime-value')) {
                            span.textContent = slider.id.includes('players') && slider.value == 0 ? "Qualsiasi" : slider.value;
                        }
                        updateGraph();
                    });
                });
                
                resetFiltersBtn.addEventListener('click', resetFilters);
                gameSearch.addEventListener('input', filterGameList);

                [yearMinSlider, yearMaxSlider].forEach(slider => {
                    slider.addEventListener('input', () => {
                        if (+yearMinSlider.value > +yearMaxSlider.value) {
                            if (slider === yearMinSlider) {
                                yearMaxSlider.value = yearMinSlider.value;
                            } else {
                                yearMinSlider.value = yearMaxSlider.value;
                            }
                        }
                        document.getElementById('year-value').textContent = `${yearMinSlider.value}-${yearMaxSlider.value}`;
                        updateGraph();
                    });
                });
                
                //Listener per Slider Tempo
                [playtimeMinSlider, playtimeMaxSlider].forEach(slider => {
                    slider.addEventListener('input', () => {
                        if (+playtimeMinSlider.value > +playtimeMaxSlider.value) {
                            if (slider === playtimeMinSlider) {
                                playtimeMaxSlider.value = playtimeMinSlider.value;
                            } else {
                                playtimeMinSlider.value = playtimeMaxSlider.value;
                            }
                        }
                        document.getElementById('playtime-value').textContent = `${playtimeMinSlider.value}-${playtimeMaxSlider.value}`;
                        updateGraph();
                    });
                });

                categorySelect.addEventListener('change', updateGraph);

                mechanicsCheckboxes.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        updateGraph();
                    }
                });
            })
            .catch(error => {
                console.error("ERRORE CRITICO: Impossibile caricare 'boardgames_100.json'.", error);
                const container = document.getElementById('graph-container');
                if (container) {
                    container.innerHTML = `<p style="color: red; text-align: center; margin-top: 50px; font-size: 1.2em;">
                                            <strong>Errore:</strong> Impossibile caricare i dati del grafo (boardgames_100.json).<br>
                                            Controlla la console per i dettagli.
                                           </p>`;
                }
            });
    }

    function resetFilters() {
        defocusNode(); 

        rankSlider.value = 100;
        ratingSlider.value = 7.7;
        reviewsSlider.value = reviewsSlider.min;
        playersSlider.value = 0;
        minAgeSlider.value = 8;
        playtimeMinSlider.value = 0;
        playtimeMaxSlider.value = 480;
        
        allSliders.forEach(slider => {
            const span = document.getElementById(`${slider.id.split('-')[0]}-value`);
            if (span) {
                if (slider.id.includes('players') && slider.value == 0) {
                    span.textContent = "Qualsiasi";
                } else if (slider.id.includes('reviews')) {
                    span.textContent = reviewsSlider.min;
                } else {
                    // Vengono esclusi gli span gestiti dai doppi slider
					if(!span.id.includes('year-value') && !span.id.includes('playtime-value')) {
						span.textContent = slider.value;
					}
                }
            }
        });

		yearMinSlider.value = yearMinSlider.min;
		yearMaxSlider.value = yearMaxSlider.max;
		document.getElementById('year-value').textContent = `${yearMinSlider.min}-${yearMaxSlider.max}`;
        document.getElementById('playtime-value').textContent = `${playtimeMinSlider.min}-${playtimeMaxSlider.max}`;
		categorySelect.value = 'all';
		mechanicsCheckboxes.querySelectorAll('input:checked').forEach(cb => cb.checked = false);
        
        gameSearch.value = "";
        updateGraph(); 
    }
    
    function initializeGraph() {
        const container = document.getElementById('graph-container');
        if (!container) {
            console.error("Errore: contenitore #graph-container non trovato.");
            return;
        }
        const width = container.clientWidth, height = container.clientHeight; 

        const panMargin = 200; 

        zoom = d3.zoom()
            .scaleExtent([0.1, 8])
            .translateExtent([
                [-panMargin, -panMargin], 
                [width + panMargin, height + panMargin]
            ])
            .on("zoom", (event) => {
                 g.attr("transform", event.transform);
            });
        
        svg = d3.select("#graph-container").append("svg")
            .attr("width", width).attr("height", height)
            .call(zoom)
            .on("click", (event) => {
                if (event.target === svg.node()) {
                    defocusNode();
                }
            });

        d3.select("body").on("keydown", (event) => {
            if (event.key === "Escape") {
                defocusNode();
            }
        });
        
        g = svg.append("g")
        
        linkSelection = g.append("g").attr("class", "links-group").selectAll(".link");
        linkLabelSelection = g.append("g").attr("class", "link-labels-group").selectAll(".link-label");
        nodeSelection = g.append("g").attr("class", "nodes-group").selectAll(".node");
        labelSelection = g.append("g").attr("class", "labels-group").selectAll(".node-label");

        gClone = g.append("g")
            .attr("class", "clone-group")
            .style("opacity", 0)
            .style("pointer-events", "none");

        gClone.append("line").attr("class", "link-self");
        gClone.append("circle").attr("class", "node clone-node");
        gClone.append("rect").attr("class", "clone-label-bg").attr("rx", 4).attr("ry", 4);
        gClone.append("text").attr("class", "node-label clone-label").attr("dy", "0.35em").style("text-anchor", "middle");
    }

    function updateGraph() {
        
        if (selectedNode) {
            defocusNode();
        }

        if (!svg) {
            console.warn("updateGraph chiamato prima di initializeGraph.");
            return;
        }

		const selectedMechanics = Array.from(mechanicsCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);
		const selectedCategory = categorySelect.value;
		
        const filteredNodes = allNodes.filter(n => 
			n.rank <= +rankSlider.value &&
			n.rating >= +ratingSlider.value &&
			n.num_reviews >= +reviewsSlider.value &&
			(+playersSlider.value === 0 ? true : (+playersSlider.value >= n.minplayers && +playersSlider.value <= n.maxplayers)) &&
			n.minage >= +minAgeSlider.value &&
            (n.minplaytime <= +playtimeMaxSlider.value) && (n.maxplaytime >= +playtimeMinSlider.value) &&
			n.year >= +yearMinSlider.value &&
			n.year <= +yearMaxSlider.value &&
			(selectedCategory === 'all' || n.categories.includes(selectedCategory)) &&
			(selectedMechanics.length === 0 || selectedMechanics.every(mech => n.mechanics.includes(mech)))
		);

        const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
        const filteredLinks = allLinks.filter(l => 
            l.source && l.target &&
            filteredNodeIds.has(l.source.id) && filteredNodeIds.has(l.target.id)
        );
        
        calculateGridLayout(filteredNodes);
        updateLegend(filteredNodes);
        populateGameList(filteredNodes);

        linkSelection = linkSelection.data(filteredLinks, d => `${d.source.id}-${d.target.id}`).join("line")
            .attr("class", "link")
            .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x).attr("y2", d => d.target.y);

        nodeSelection = nodeSelection.data(filteredNodes, d => d.id).join("circle")
            .attr("class", "node")
            .attr("r", d => d.r)
            .attr("fill", d => colorScale(d.primaryCategory))
            .attr("cx", d => d.x).attr("cy", d => d.y)
            .sort((a, b) => b.rating - a.rating)
            .on("mouseover", (e, d) => { if (!selectedNode) { showCloneAndHighlight(e, d); }})
            .on("mouseout", (e, d) => { if (!selectedNode) { hideCloneAndUnhighlight(d); }})
            .on("click", handleNodeClick); // Click per selezionare

        labelSelection = labelSelection.data(filteredNodes, d => d.id).join("text")
            .attr("class", "node-label")
            .text(d => d.title.length > 20 ? d.title.substring(0, 20) + "..." : d.title)
            .attr("dy", "0.35em")
            .style("text-anchor", d => getLabelAnchor(d))
            .attr("transform", d => getLabelTransform(d));

        if (isInitialLoad) {
            linkSelection.style("stroke-opacity", 0);
            nodeSelection.style("opacity", 0);
            labelSelection.style("fill-opacity", 0);
            const t = d3.transition().duration(2500);
            nodeSelection.transition(t).delay((d, i) => i * 7).style("opacity", 1);
            linkSelection.transition(t).delay(1000).style("stroke-opacity", 0.4);
            labelSelection.transition(t).delay(1500).style("fill-opacity", 1);
            isInitialLoad = false;
        }
    }
    
    function handleNodeClick(event, d) {
        event.stopPropagation();
        const isSameNode = selectedNode && selectedNode.id === d.id;
        
        if (selectedNode) {
            defocusNode();
        }
        if (!isSameNode) {
            selectedNode = d;
            showCloneAndHighlight(event, d);
            gameListUL.selectAll("li")
                .classed("highlighted-list-item", li_d => li_d.id === d.id);
        }
    }
    
    function defocusNode() {
        if (!selectedNode) return;
        const previouslySelected = selectedNode;
        selectedNode = null; 
        hideCloneAndUnhighlight(previouslySelected);
        gameListUL.selectAll("li").classed("highlighted-list-item", false);
    }

    function calculateGridLayout(nodes) {
        if (!svg) return;
        
        const width = svg.node().parentElement.clientWidth;
        const height = svg.node().parentElement.clientHeight; 
        centerX = width / 2;
        centerY = height / 2;
        const radius = Math.min(width, height) / 2 * 0.80;

        nodes.sort((a, b) => {
            const categoryCompare = a.primaryCategory.localeCompare(b.primaryCategory);
            if (categoryCompare !== 0) return categoryCompare;
            return b.rating - a.rating;
        });
        
        const numNodes = nodes.length;
        if (numNodes === 0) return;
        
        const angleStep = (2 * Math.PI) / numNodes;

        nodes.forEach((node, i) => {
            const angle = (i * angleStep) - (Math.PI / 2);
            node.x = centerX + radius * Math.cos(angle);
            node.y = centerY + radius * Math.sin(angle);
            node.angle = angle; 
        });
    }

    function getLabelTransform(n) {
        const offset = n.r + 8;
        const x = n.x + offset * Math.cos(n.angle);
        const y = n.y + offset * Math.sin(n.angle);
        const angleDeg = n.angle * (180 / Math.PI);
        const isRightHalf = (n.angle > -Math.PI / 2 && n.angle < Math.PI / 2);
        const rotation = isRightHalf ? angleDeg : angleDeg + 180;
        return `translate(${x}, ${y}) rotate(${rotation})`;
    }

    function getLabelAnchor(n) {
        const isRightHalf = (n.angle > -Math.PI / 2 && n.angle < Math.PI / 2);
        return isRightHalf ? "start" : "end";
    }

    function updateLegend(nodes) {
        const categories = [...new Set(nodes.map(n => n.primaryCategory))].sort();
        legendUL.selectAll("li").data(categories, d => d).join("li")
            .html(d => `<span class="legend-swatch" style="background-color: ${colorScale(d)}"></span>${d}`);
    }
    
    function populateGameList(nodes) {
        const sortedNodes = [...nodes].sort((a,b)=> a.rank - b.rank);
        
        gameListUL.selectAll("li").data(sortedNodes, d => d.id).join("li")
            .text(d => `${d.rank} - ${d.title}`)
            .on("mouseover", (e, d) => {
                if (!selectedNode) {
                    const nodeElement = nodeSelection.filter(n => n.id === d.id).node();
                    if (nodeElement) {
                        const fakeEvent = { target: nodeElement };
                        showCloneAndHighlight(fakeEvent, d);
                    }
                }
                d3.select(e.currentTarget).classed("highlighted-list-item", true);
            })
            .on("mouseout", (e, d) => {
                 if (!selectedNode) {
                     hideCloneAndUnhighlight(d);
                 }
                 if (!selectedNode || selectedNode.id !== d.id) {
                    d3.select(e.currentTarget).classed("highlighted-list-item", false);
                 }
            })
            .on("click", (e, d) => {
                const nodeElement = nodeSelection.filter(n => n.id === d.id).node();
                 if (nodeElement) {
                    const fakeEvent = { target: nodeElement, stopPropagation: () => {} };
                    handleNodeClick(fakeEvent, d);
                }
            }); 
        
        filterGameList();
    }
    
    function filterGameList() {
        const searchTerm = gameSearch.value.toLowerCase();
        gameListUL.selectAll("li")
            .style("display", d => (d && d.title && d.title.toLowerCase().includes(searchTerm)) ? "block" : "none");
    }
    
    // Funzione che gestisce l'highlight
    function highlightNode(event, d) {
        if (!d || d.id === undefined) return;
        
        const neighborIds = new Set([d.id]);

        // Opacità link ATTIVI forzata, INATTIVI invariati
        linkSelection
            .classed("highlight", l => {
                if (l.source.id === d.id || l.target.id === d.id) {
                    neighborIds.add(l.source.id);
                    neighborIds.add(l.target.id);
                    return true;
                } return false;
            })
            .style("stroke-opacity", l => {
                const isActive = (l.source.id === d.id || l.target.id === d.id);
                // Se è attivo, forza opacità 1.0 (piena)
                // Se è inattivo, 'null' fa sì che usi il valore di default del CSS
                return isActive ? 0.70 : null; 
            });
        
        // Opacizzazione forzata per NODI e NOMI INATTIVI
        nodeSelection
            .classed("highlight", n => n.id === d.id)
            .style("opacity", n => neighborIds.has(n.id) ? 1 : 0.1); 

        labelSelection
            .classed("highlight-label", n => n.id === d.id)
            .style("opacity", n => neighborIds.has(n.id) ? 1 : 0.1); 

        gClone.classed("highlight", gClone.style("opacity") == 1); 


        const neighborNodes = allNodes.filter(n => neighborIds.has(n.id) && n.id !== d.id);
        const connectionCount = neighborNodes.length;
        const robustness = neighborNodes.reduce((acc, curr) => acc + curr.rating, 0);

        // Tooltip
        tooltip.transition().duration(200).style("opacity", 1);
        tooltip.html(`<strong>${d.title} (${d.year})</strong>
                      <br><strong>Rank:</strong> ${d.rank} | <strong>Rating:</strong> ${d.rating.toFixed(2)} (${d.num_reviews.toLocaleString('it-IT')} rec.)
                      <br><strong>Giocatori:</strong> ${d.minplayers}-${d.maxplayers} | <strong>Durata:</strong> ${d.minplaytime}-${d.maxplaytime} min | <strong>Età:</strong> ${d.minage}+
                      <br><strong>Connessioni:</strong> ${connectionCount}
                      <br><strong>Robustezza Rec.:</strong> ${robustness.toFixed(2)}`)
            .style("top", "20px")   
            .style("right", "20px")   
            .style("left", null)
            .style("transform", null);

        tooltipDetails.transition().duration(200).style("opacity", 1);
        tooltipDetails.html(`<strong>Categoria:</strong> ${d.primaryCategory}
                             <br><strong>Designers:</strong> ${d.designers.join(', ')}
                             <br><strong>Meccaniche:</strong> ${d.mechanics.join(', ')}`)
            .style("top", "20px")
            .style("left", "20px")
            .style("right", null)
            .style("transform", null);
            
        return neighborNodes;
    }

    // Rimuove tutte le evidenziazioni
    function unhighlightNodes() {
        hideTooltip();
        
        // Reset opacità forzata NODI e NOMI
        nodeSelection.classed("highlight", false).style("opacity", 1);
        labelSelection.classed("highlight-label", false).style("opacity", 1);
        
        gClone.classed("highlight", false); 

        //Reset opacità link
        // Rimuove la classe .highlight e lo stile forzato,
        // riportando tutti i link a 0.4 di opacità (da CSS)
        linkSelection.classed("highlight", false).style("stroke-opacity", null);
        
        linkLabelSelection = linkLabelSelection.data([], d => d.id);
        linkLabelSelection.exit()
            .transition().duration(150)
            .style("opacity", 0)
            .remove();
    }

    // Mostra il clone al centro
    function showCloneAndHighlight(e, d) {
		playNodeAudio(); // Audio al click/hover
        const neighborNodes = highlightNode(e, d);
        
        // Setup del clone
        gClone.select("circle")
            .attr("r", d.r)
            .attr("fill", colorScale(d.primaryCategory));
        
        gClone.select("text")
            .text(d.title)
            .attr("transform", `translate(0, ${-d.r - 15})`);
        
        const textNode = gClone.select("text").node();
        if (textNode) {
            const bbox = textNode.getBBox();
            gClone.select("rect.clone-label-bg")
                .attr("x", bbox.x - 4)
                .attr("y", bbox.y - 2)
                .attr("width", bbox.width + 8)
                .attr("height", bbox.height + 4)
                .attr("transform", gClone.select("text").attr("transform"));
        }

        // Calcolo "self-link"
        const originalNodeX = d.x;
        const originalNodeY = d.y;
        const dx = originalNodeX - centerX;
        const dy = originalNodeY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        let endX = dx, endY = dy;
        if (distance > 0) {
            endX = (dx / distance) * (distance - d.r);
            endY = (dy / distance) * (distance - d.r);
        }
        gClone.select(".link-self")
            .attr("x1", 0).attr("y1", 0)
            .attr("x2", endX).attr("y2", endY);

        gClone.attr("transform", `translate(${centerX}, ${centerY})`)
            .transition().duration(150) 
            .style("opacity", 1);
        
        gClone.classed("highlight", true); 

        // Animazione link
        const highlightedLinks = linkSelection.filter(".highlight"); 

        highlightedLinks
            .style("stroke", l => { 
                const neighbor = l.source.id === d.id ? l.target : l.source;
                return colorScale(neighbor.primaryCategory);
            })
            .transition().duration(150)
            .attr("x1", l => (l.source.id === d.id) ? centerX : l.source.x)
            .attr("y1", l => (l.source.id === d.id) ? centerY : l.source.y)
            .attr("x2", l => (l.target.id === d.id) ? centerX : l.target.x)
            .attr("y2", l => (l.target.id === d.id) ? centerY : l.target.y);
            
        highlightedLinks.raise();

        // Numerazione Archi
        const sortedNeighbors = neighborNodes.sort((a, b) => {
            let diffA = a.angle - d.angle;
            let diffB = b.angle - d.angle;
            if (diffA < 0) diffA += 2 * Math.PI;
            if (diffB < 0) diffB += 2 * Math.PI;
            return diffA - diffB;
        });

        const labelData = sortedNeighbors.map((neighbor, i) => ({
            id: neighbor.id,
            number: i + 1,
            x: centerX + (neighbor.x - centerX) * 0.8,
            y: centerY + (neighbor.y - centerY) * 0.8,
            color: colorScale(neighbor.primaryCategory)
        }));

        linkLabelSelection = linkLabelSelection.data(labelData, d => d.id)
            .join(
                enter => enter.append("text")
                    .attr("class", "link-label")
                    .attr("x", d => d.x).attr("y", d => d.y)
                    .attr("fill", d => d.color)
                    .text(d => d.number)
                    .style("opacity", 0)
                    .call(enter => enter.transition().duration(150).style("opacity", 1)),
                update => update
                    .call(update => update.transition().duration(150)
                        .attr("x", d => d.x).attr("y", d => d.y)
                        .attr("fill", d => d.color)
                        .text(d => d.number).style("opacity", 1)),
                exit => exit
                    .call(exit => exit.transition().duration(150).style("opacity", 0).remove())
            );
    }

    // Nasconde il clone
    function hideCloneAndUnhighlight(d) {
        if (!d || d.id === undefined) return;
        if (selectedNode && selectedNode.id === d.id) return; 

        gClone.transition().duration(150).style("opacity", 0);
        gClone.classed("highlight", false);

        linkSelection
            .filter(l => l.source.id === d.id || l.target.id === d.id)
            .style("stroke", null)
            .transition().duration(150)
            .attr("x1", l => l.source.x).attr("y1", l => l.source.y)
            .attr("x2", l => l.target.x).attr("y2", l => l.target.y);

        unhighlightNodes();
    }

    function hideTooltip() {
        tooltip.transition().duration(200).style("opacity", 0);
        tooltipDetails.transition().duration(200).style("opacity", 0);
    }

    // --- Funzioni per i Grafici Statistici ---
    function createStatsCharts(data) {
        // Grafico 1: Giochi per anno
        const gamesByYear = data.reduce((acc, game) => { acc[game.year] = (acc[game.year] || 0) + 1; return acc; }, {});
        const sortedYears = Object.keys(gamesByYear).sort((a, b) => a - b);
        const yearData = sortedYears.map(year => gamesByYear[year]);
        const ctx1 = document.getElementById('games-by-year-chart').getContext('2d');
        if (chart1) chart1.destroy();
        chart1 = new Chart(ctx1, { type: 'bar', data: { labels: sortedYears, datasets: [{ 
            label: 'Numero di Giochi', 
            data: yearData, 
            backgroundColor: 'rgba(116, 192, 252, 0.7)',
            borderColor: 'rgba(116, 192, 252, 1)',
            borderWidth: 1,
            hoverBackgroundColor: 'rgba(116, 192, 252, 1)',
            hoverBorderColor: 'rgba(0, 0, 0, 1)',
            hoverBorderWidth: 2
        }] }, options: { responsive: true, maintainAspectRatio: false } });

        // Grafico 2: Top 10 categorie
        const categoryCounts = data.flatMap(g => g.types.categories.map(c => c.name)).reduce((acc, cat) => { acc[cat] = (acc[cat] || 0) + 1; return acc; }, {});
        const sortedCategories = Object.entries(categoryCounts).sort(([,a],[,b]) => b-a).slice(0, 10);
        const ctx2 = document.getElementById('top-categories-chart').getContext('2d');
        if (chart2) chart2.destroy();
        chart2 = new Chart(ctx2, { type: 'bar', data: { labels: sortedCategories.map(([n]) => n), datasets: [{ 
            label: 'Numero di Giochi', 
            data: sortedCategories.map(([,c]) => c), 
            backgroundColor: 'rgba(166, 233, 213, 0.8)',
            borderColor: 'rgba(166, 233, 213, 1)',
            borderWidth: 1,
            hoverBackgroundColor: 'rgba(166, 233, 213, 1)',
            hoverBorderColor: 'rgba(0, 0, 0, 1)',
            hoverBorderWidth: 2
        }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false } });
    
        // Grafico 3: Età minima
        const ageCounts = data.reduce((acc, game) => { acc[game.minage] = (acc[game.minage] || 0) + 1; return acc; }, {});
        const sortedAges = Object.keys(ageCounts).sort((a, b) => a - b);
        const ageData = sortedAges.map(age => ageCounts[age]);
        const ctx3 = document.getElementById('minage-chart').getContext('2d');
        if (chart3) chart3.destroy();
        chart3 = new Chart(ctx3, { type: 'bar', data: { labels: sortedAges, datasets: [{ 
            label: 'Numero di Giochi', 
            data: ageData, 
            backgroundColor: 'rgba(252, 186, 116, 0.8)',
            borderColor: 'rgba(252, 186, 116, 1)',
            borderWidth: 1,
            hoverBackgroundColor: 'rgba(252, 186, 116, 1)',
            hoverBorderColor: 'rgba(0, 0, 0, 1)',
            hoverBorderWidth: 2
        }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });

        // Grafico 4: Tempo di gioco
        const playtimeBuckets = { '0-30': 0, '31-60': 0, '61-90': 0, '91-120': 0, '120+': 0 };
        data.forEach(game => {
            if (game.minplaytime <= 30) playtimeBuckets['0-30']++;
            else if (game.minplaytime <= 60) playtimeBuckets['31-60']++;
            else if (game.minplaytime <= 90) playtimeBuckets['61-90']++;
            else if (game.minplaytime <= 120) playtimeBuckets['91-120']++;
            else playtimeBuckets['120+']++;
        });
        const playtimeLabels = Object.keys(playtimeBuckets);
        const playtimeData = Object.values(playtimeBuckets);
        const ctx4 = document.getElementById('playtime-chart').getContext('2d');
        if (chart4) chart4.destroy();
        chart4 = new Chart(ctx4, { type: 'doughnut', data: { labels: playtimeLabels, datasets: [{ 
            label: 'Numero di Giochi', 
            data: playtimeData, 
            backgroundColor: ['#74C0FC', '#B1E3FF', '#A6E9D5', '#3DDCF0', '#2E8BC0'],
            borderColor: '#FFFFFF',
            borderWidth: 2,
            hoverBorderColor: '#000000',
            hoverBorderWidth: 3
        }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } });
    }

    // Grafico 5: Robustezza
    function createRobustnessChart() {
        const robustnessData = [];
        allNodes.forEach(node => {
            const neighborIds = new Set();
            allLinks.forEach(l => {
                if (l.source.id === node.id) neighborIds.add(l.target.id);
                if (l.target.id === node.id) neighborIds.add(l.source.id);
            });
            const neighborNodes = allNodes.filter(n => neighborIds.has(n.id) && n.id !== node.id);
            const robustness = neighborNodes.reduce((acc, curr) => acc + curr.rating, 0);
            robustnessData.push({ title: node.title, robustness: robustness });
        });

        const sortedRobustness = robustnessData.sort((a, b) => b.robustness - a.robustness).slice(0, 10);
        const labels = sortedRobustness.map(d => d.title);
        const dataValues = sortedRobustness.map(d => d.robustness);

        const ctx5 = document.getElementById('robustness-chart').getContext('2d');
        if (chart5) chart5.destroy();
        chart5 = new Chart(ctx5, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Robustezza di Raccomandazione',
                    data: dataValues,
                    backgroundColor: 'rgba(153, 102, 255, 0.7)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1,
                    hoverBackgroundColor: 'rgba(153, 102, 255, 1)',
                    hoverBorderColor: 'rgba(0, 0, 0, 1)',
                    hoverBorderWidth: 2
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { beginAtZero: true, title: { display: true, text: 'Robustezza' }},
                    y: { title: { display: true, text: 'Gioco' }}
                }
            }
        });
    }
});