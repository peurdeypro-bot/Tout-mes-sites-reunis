const cards = [...document.querySelectorAll(".project-card")];
const filterButtons = [...document.querySelectorAll(".filter-button")];
const searchInput = document.querySelector("#project-search");
const visibleCount = document.querySelector("#visible-count");
const emptyState = document.querySelector("#empty-state");
let activeFilter = "all";

function updateProjects() {
    const query = searchInput.value.trim().toLocaleLowerCase("fr");
    let count = 0;

    for (const card of cards) {
        const matchesFilter = activeFilter === "all" || card.dataset.category === activeFilter;
        const matchesSearch = `${card.dataset.search} ${card.textContent}`.toLocaleLowerCase("fr").includes(query);
        const isVisible = matchesFilter && matchesSearch;
        card.hidden = !isVisible;
        count += Number(isVisible);
    }

    visibleCount.textContent = String(count).padStart(2, "0");
    emptyState.hidden = count !== 0;
}

for (const button of filterButtons) {
    button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        for (const filterButton of filterButtons) {
            const isActive = filterButton === button;
            filterButton.classList.toggle("is-active", isActive);
            filterButton.setAttribute("aria-pressed", String(isActive));
        }
        updateProjects();
    });
}

searchInput.addEventListener("input", updateProjects);

document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== searchInput) {
        event.preventDefault();
        searchInput.focus();
    }
    if (event.key === "Escape" && document.activeElement === searchInput) {
        searchInput.value = "";
        searchInput.blur();
        updateProjects();
    }
});