let names = {};


// ========================================
// LOAD MAP + DATA
// ========================================

Promise.all([
    fetch("indigenous-map.svg").then(response => response.text()),
    fetch("names.json").then(response => response.json())
])
.then(([svgData, jsonData]) => {

    document.getElementById("map-container").innerHTML = svgData;

    names = jsonData;

    initMap();

})
.catch(error => {
    console.error("Error loading map:", error);
});


// ========================================
// MAP SETTINGS
// ========================================

const SVG_RATIO = 2.1;

const mapWrapper = document.getElementById("map-wrapper");
const appTitle = document.getElementById("app-title");


// ========================================
// RESIZE MAP
// ========================================

function adjustMapSize() {

    const titleStyle = getComputedStyle(appTitle);

    const titleMargin =
        parseFloat(titleStyle.marginBottom) || 0;

    const description =
        document.getElementById("app-description");

    const descriptionHeight =
        description.offsetHeight;

    const reservedSpace =
        appTitle.offsetHeight +
        titleMargin +
        descriptionHeight +
        80;

    const maxWidth =
        window.innerWidth * 0.95;

    const maxHeight =
        Math.max(
            200,
            window.innerHeight - reservedSpace
        );

    let width = maxWidth;

    let height =
        width / SVG_RATIO;

    if (height > maxHeight) {

        height = maxHeight;

        width =
            height * SVG_RATIO;
    }

    mapWrapper.style.width =
        `${width}px`;

    mapWrapper.style.height =
        `${height}px`;
}


// Set initial size

adjustMapSize();


// ========================================
// INITIALIZE MAP
// ========================================

function initMap() {

    const overlay =
        document.getElementById("overlay");

    const closeBtn =
        document.getElementById("close-btn");

    const cardLocation = document.getElementById("card-location");
    const cardName = document.getElementById("card-name");
    const cardLanguage = document.getElementById("card-language");
    const cardHistory = document.getElementById("card-history");
    const cardSource = document.getElementById("card-source");

    const svgElement =
        document.querySelector("#map-container svg");


    // ========================================
    // ZOOM
    // ========================================

    const baseScale = 1.035;

    const minScale = baseScale;

    const maxScale =
        baseScale * 6;

    let scale = baseScale;

    let translateX = 0;

    let translateY = 0;


    const marginFraction =
        (baseScale - 1) /
        (2 * baseScale);


    // ========================================
    // DRAG
    // ========================================

    let isDragging = false;

    let dragMoved = false;

    let dragStartX = 0;

    let dragStartY = 0;

    let dragOrigTranslateX = 0;

    let dragOrigTranslateY = 0;


    // ========================================
    // APPLY TRANSFORMATION
    // ========================================

    function updateTransformation() {
        if (svgElement) {
            svgElement.style.transform =
                `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        }

        points.forEach(point => {
            const originalRadius = point.dataset.originalRadius;

            if (originalRadius) {
                point.setAttribute(
                    "r",
                    originalRadius / scale
                );
            }
        });
    }


    // ========================================
    // LIMIT MAP MOVEMENT
    // ========================================

    function limitTranslation(
        tx,
        ty,
        s,
        rectW,
        rectH
    ) {

        const maxX =
            -marginFraction *
            rectW *
            s;

        const minX =
            rectW -
            rectW *
            s *
            (1 - marginFraction);

        const maxY =
            -marginFraction *
            rectH *
            s;

        const minY =
            rectH -
            rectH *
            s *
            (1 - marginFraction);


        return [

            Math.min(
                maxX,
                Math.max(minX, tx)
            ),

            Math.min(
                maxY,
                Math.max(minY, ty)
            )

        ];
    }


    // ========================================
    // CENTER MAP
    // ========================================

    function centerMap() {

        const rect =
            mapWrapper.getBoundingClientRect();

        [
            translateX,
            translateY
        ] =
            limitTranslation(
                0,
                0,
                scale,
                rect.width,
                rect.height
            );

        updateTransformation();
    }


    // ========================================
    // ZOOM TOWARD POINT
    // ========================================

    function zoomTowardPoint(
        delta,
        clientX,
        clientY
    ) {

        const rect =
            mapWrapper.getBoundingClientRect();


        const originX =
            clientX !== undefined
                ? clientX - rect.left
                : rect.width / 2;


        const originY =
            clientY !== undefined
                ? clientY - rect.top
                : rect.height / 2;


        const newScale =
            Math.max(
                minScale,
                Math.min(
                    maxScale,
                    scale + delta
                )
            );


        if (newScale === scale) {
            return;
        }


        const contentX =
            (originX - translateX) /
            scale;

        const contentY =
            (originY - translateY) /
            scale;


        scale = newScale;


        const newX =
            originX -
            contentX * scale;

        const newY =
            originY -
            contentY * scale;


        [
            translateX,
            translateY
        ] =
            limitTranslation(
                newX,
                newY,
                scale,
                rect.width,
                rect.height
            );


        updateTransformation();
    }


    // ========================================
    // ZOOM BUTTONS
    // ========================================

    const zoomIn =
        document.getElementById("zoom-in");

    const zoomOut =
        document.getElementById("zoom-out");


    zoomIn.addEventListener(
        "click",
        () => zoomTowardPoint(0.5)
    );


    zoomOut.addEventListener(
        "click",
        () => zoomTowardPoint(-0.5)
    );


    // ========================================
    // MOUSE WHEEL
    // ========================================

    mapWrapper.addEventListener(
        "wheel",
        (e) => {

            e.preventDefault();

            const zoomIntensity = 0.15;

            const delta =
                e.deltaY < 0
                    ? zoomIntensity
                    : -zoomIntensity;


            zoomTowardPoint(
                delta,
                e.clientX,
                e.clientY
            );

        },
        {
            passive: false
        }
    );


    // ========================================
    // MOUSE DOWN
    // ========================================

    mapWrapper.addEventListener(
        "mousedown",
        (e) => {

            if (
                e.button !== 0 ||
                e.target.closest("#zoom-controls")
            ) {
                return;
            }


            if (
                scale <=
                minScale + 0.000001
            ) {
                return;
            }


            isDragging = true;

            dragMoved = false;

            dragStartX = e.clientX;

            dragStartY = e.clientY;

            dragOrigTranslateX =
                translateX;

            dragOrigTranslateY =
                translateY;


            mapWrapper.classList.add(
                "dragging"
            );


            svgElement.style.transition =
                "none";
        }
    );


    // ========================================
    // MOUSE MOVE
    // ========================================

    window.addEventListener(
        "mousemove",
        (e) => {

            if (!isDragging) {
                return;
            }


            const dx =
                e.clientX -
                dragStartX;

            const dy =
                e.clientY -
                dragStartY;


            if (
                Math.abs(dx) > 3 ||
                Math.abs(dy) > 3
            ) {
                dragMoved = true;
            }


            const rect =
                mapWrapper.getBoundingClientRect();


            [
                translateX,
                translateY
            ] =
                limitTranslation(
                    dragOrigTranslateX + dx,
                    dragOrigTranslateY + dy,
                    scale,
                    rect.width,
                    rect.height
                );


            updateTransformation();
        }
    );


    // ========================================
    // MOUSE UP
    // ========================================

    window.addEventListener(
        "mouseup",
        () => {

            if (!isDragging) {
                return;
            }


            isDragging = false;


            mapWrapper.classList.remove(
                "dragging"
            );


            svgElement.style.transition =
                "transform 0.1s ease-out";
        }
    );


    // ========================================
    // CITY POINTS
    // ========================================

    const points = document.querySelectorAll('#cities circle');

    points.forEach(point => {
        point.dataset.originalRadius = point.getAttribute("r");
    });

    points.forEach(point => {
        const cityId = point.id;
        const data = names[cityId];

        if (!data) return;

        point.addEventListener("mouseenter", () => {
            const originalRadius = parseFloat(
                point.dataset.originalRadius
            );

            point.setAttribute(
                "r",
                (originalRadius * 2) / scale
            );

            showTooltip(data.name, data.city);
        });


        point.addEventListener("mousemove", (e) => {
            moveTooltip(e.clientX, e.clientY);
        });

        point.addEventListener("mouseleave", () => {
            const originalRadius = parseFloat(
                point.dataset.originalRadius
            );

            point.setAttribute(
                "r",
                originalRadius / scale
            );

            hideTooltip();
        });

        point.addEventListener("click", () => {
            if (dragMoved) return;

            cardName.textContent = data.name.toUpperCase();

            cardLocation.textContent =
                `${data.city}, ${data.province}`;

            cardLanguage.textContent =
                `Language of origin: ${data.language}`;

            cardHistory.textContent = data.history;

            cardSource.textContent =
                `Source: ${data.source}`;

            overlay.classList.remove("hidden");
        });
    });


    // ========================================
    // CLOSE CARD
    // ========================================

    closeBtn.addEventListener(
        "click",
        () => {

            overlay.classList.add(
                "hidden"
            );
        }
    );


    overlay.addEventListener(
        "click",
        (e) => {

            if (e.target === overlay) {

                overlay.classList.add(
                    "hidden"
                );
            }
        }
    );


    // ========================================
    // INITIAL POSITION
    // ========================================

    centerMap();


    // ========================================
    // RESIZE
    // ========================================

    window.addEventListener(
        "resize",
        () => {

            adjustMapSize();

            scale = baseScale;

            centerMap();
        }
    );
}


// ========================================
// INDIGENOUS NAME
// ========================================

function showTooltip(name, city) {
    let tooltip = document.getElementById("tooltip");

    if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.id = "tooltip";
        document.body.appendChild(tooltip);
    }

    tooltip.innerHTML = `
        <div class="tooltip-name">${name}</div>
        <div class="tooltip-city">${city}</div>
    `;

    tooltip.classList.add("visible");
}


function moveTooltip(
    x,
    y
) {

    const tooltip =
        document.getElementById("tooltip");


    if (!tooltip) {
        return;
    }


    tooltip.style.left =
        `${x}px`;

    tooltip.style.top =
        `${y}px`;
}


function hideTooltip() {

    const tooltip =
        document.getElementById("tooltip");


    if (tooltip) {

        tooltip.classList.remove(
            "visible"
        );
    }
}