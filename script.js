const atlas = document.getElementById("atlas");

categories.forEach(category => {

    const section = document.createElement("section");

    section.className = "category";


    section.innerHTML = `
        <div class="category-header">
            <h2>${category.name}</h2>
        </div>

        <div class="carousel">

            <button class="arrow left" aria-label="Previous">
                ‹
            </button>

            <div class="cards"></div>

            <button class="arrow right" aria-label="Next">
                ›
            </button>

        </div>
    `;


    const cards = section.querySelector(".cards");


    category.maps.forEach(map => {

        const card = document.createElement("a");

        card.className = "card";

        card.href = map.link;


        card.innerHTML = `
            <div class="image-container">
                <img src="${map.image}" alt="${map.name}">
            </div>

            <div class="card-content">

                <h3>${map.name}</h3>

                <p>
                    ${map.description}
                </p>

                <span class="reference">
                    Source: ${map.reference}
                </span>

            </div>
        `;


        cards.appendChild(card);

    });


    const leftButton = section.querySelector(".left");
    const rightButton = section.querySelector(".right");


    rightButton.addEventListener("click", () => {

        cards.scrollBy({
            left: 360,
            behavior: "smooth"
        });

    });


    leftButton.addEventListener("click", () => {

        cards.scrollBy({
            left: -360,
            behavior: "smooth"
        });

    });


    atlas.appendChild(section);

});