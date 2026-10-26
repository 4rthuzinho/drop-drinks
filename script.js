const siteHeader = document.querySelector(".site-header");
const quickAccess = document.querySelector(".quick-access");
const quickCards = Array.from(document.querySelectorAll(".quick-card"));
const sections = Array.from(document.querySelectorAll("[data-section]"));
function updateQuickAccessMode() {
  const hasScrolled = window.scrollY > 120;

  if (siteHeader) {
    siteHeader.classList.toggle("is-scrolled", hasScrolled);
  }

  if (!quickAccess) return;
  quickAccess.classList.toggle("is-tabs", window.scrollY > 260);
}

function setActiveTab(sectionId) {
  quickCards.forEach((card) => {
    card.classList.toggle("active", card.dataset.tab === sectionId);
  });
}

function observeSections() {
  if (!("IntersectionObserver" in window) || sections.length === 0) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visibleEntry) {
        setActiveTab(visibleEntry.target.dataset.section);
      }
    },
    {
      rootMargin: "-35% 0px -45% 0px",
      threshold: [0.1, 0.35, 0.6]
    }
  );

  sections.forEach((section) => observer.observe(section));
}

window.addEventListener('scroll', updateQuickAccessMode, { passive: true });
window.addEventListener('resize', updateQuickAccessMode);
updateQuickAccessMode();
observeSections();
