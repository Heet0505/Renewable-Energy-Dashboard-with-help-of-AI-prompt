// Leaflet GIS Mapping for Ahmedabad MSME Clusters
let map;
let markers = {};

// GIDC Clusters Coordinates and Info
const CLUSTERS = {
    textile: {
        name: "Vatva GIDC (Textile Sector)",
        coords: [22.9602, 72.6322],
        color: "#FFC857", // Solar yellow
        industry: "Textile manufacturing & sizing units"
    },
    pharmaceutical: {
        name: "Naroda GIDC (Pharma Sector)",
        coords: [23.0722, 72.6515],
        color: "#7B61FF", // Battery purple
        industry: "Active Pharmaceutical Ingredients (API) plants"
    },
    chemical: {
        name: "Vatva GIDC (Chemical Sector)",
        coords: [22.9550, 72.6450],
        color: "#2EC4B6", // Wind cyan
        industry: "Chemical dyestuff & intermediates plants"
    },
    engineering: {
        name: "Odhav GIDC (Engineering Sector)",
        coords: [23.0315, 72.6612],
        color: "#FF8C42", // Demand orange
        industry: "Metal fabrication & machine shops"
    },
    packaging: {
        name: "Changodar Industrial Area",
        coords: [22.9234, 72.4412],
        color: "#2ECC71", // Grid green
        industry: "Flexible packaging & corrugated printing lines"
    },
    food_processing: {
        name: "Kathwada GIDC (Food Sector)",
        coords: [23.0545, 72.6888],
        color: "#FF5A5F", // Risk red
        industry: "Food processing & refrigeration storage units"
    }
};

function initDashboardMap() {
    // Center map on Ahmedabad
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([23.0150, 72.5850], 11);

    // Add CartoDB Dark Matter Tiles for premium dark smart-city look
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    // Create custom pulsing div icon for markers
    Object.keys(CLUSTERS).forEach(key => {
        const cluster = CLUSTERS[key];
        
        // Define pulse CSS in JavaScript to be injected
        const pulseStyle = `
            background-color: ${cluster.color};
            box-shadow: 0 0 0 0 ${cluster.color}bf;
        `;

        const customIcon = L.divIcon({
            className: 'custom-map-marker-container',
            html: `<div class="map-marker-pulse-dot" style="${pulseStyle}"></div><div class="map-marker-core" style="background-color: ${cluster.color}"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        const marker = L.marker(cluster.coords, { icon: customIcon }).addTo(map);
        
        // Setup popup text
        const popupContent = `
            <div class="map-popup">
                <h4 style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 4px;">${cluster.name}</h4>
                <p style="font-family: 'Outfit', sans-serif; font-size: 11px; color: #9CA3AF; margin-bottom: 2px;">${cluster.industry}</p>
                <div style="display: flex; gap: 8px; margin-top: 6px; font-size: 10px;">
                    <span style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; color: ${cluster.color}">${key.toUpperCase()}</span>
                </div>
            </div>
        `;
        
        marker.bindPopup(popupContent, {
            closeButton: false,
            className: 'leaflet-popup-custom'
        });

        markers[key] = marker;
    });

    // Style map overlays dynamically
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
        .custom-map-marker-container {
            position: relative;
        }
        .map-marker-core {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            position: absolute;
            top: 5px;
            left: 5px;
            border: 1.5px solid #fff;
            z-index: 5;
        }
        .map-marker-pulse-dot {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            position: absolute;
            top: 0;
            left: 0;
            animation: marker-pulse 2s infinite;
        }
        @keyframes marker-pulse {
            0% {
                transform: scale(0.5);
                opacity: 1;
                box-shadow: 0 0 0 0 rgba(255,255,255,0.7);
            }
            70% {
                transform: scale(1.8);
                opacity: 0;
                box-shadow: 0 0 0 10px rgba(255,255,255,0);
            }
            100% {
                transform: scale(0.5);
                opacity: 0;
                box-shadow: 0 0 0 0 rgba(255,255,255,0);
            }
        }
        .leaflet-popup-content-wrapper {
            background: #131926 !important;
            color: #fff !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
            backdrop-filter: blur(8px) !important;
            border-radius: 8px !important;
            padding: 8px 12px !important;
        }
        .leaflet-popup-tip {
            background: #131926 !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
        }
    `;
    document.head.appendChild(styleElement);
}

function focusMapOnCluster(profileId) {
    const cluster = CLUSTERS[profileId];
    if (cluster && map) {
        map.setView(cluster.coords, 13, {
            animate: true,
            duration: 1.5
        });
        
        // Open the marker's popup
        if (markers[profileId]) {
            setTimeout(() => {
                markers[profileId].openPopup();
            }, 1000);
        }
    }
}
window.initDashboardMap = initDashboardMap;
window.focusMapOnCluster = focusMapOnCluster;
