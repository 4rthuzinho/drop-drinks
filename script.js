const WHATSAPP_NUMBER = "5531992152738";

const quickAccess = document.querySelector(".quick-access");
const quickCards = Array.from(document.querySelectorAll(".quick-card"));
const sections = Array.from(document.querySelectorAll("[data-section]"));
const quoteForm = document.querySelector("#quoteForm");
const messagePreview = document.querySelector("#messagePreview");
const copyButton = document.querySelector("#copyMessage");
const formStatus = document.querySelector("#formStatus");

const futureAdmin = {
  enabled: false,
  mountSelector: "[data-admin-ready]",
  routes: []
};

function updateQuickAccessMode() {
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

function valueFromForm(formData, key, fallback = "Nao informado") {
  const value = String(formData.get(key) || "").trim();
  return value || fallback;
}

function formatDate(dateValue) {
  if (!dateValue) return "Nao informada";
  const [year, month, day] = dateValue.split("-");
  return `${day}/${month}/${year}`;
}

function buildWhatsAppMessage() {
  const formData = new FormData(quoteForm);
  const nome = valueFromForm(formData, "nome");
  const evento = valueFromForm(formData, "evento");
  const data = formatDate(formData.get("data"));
  const local = valueFromForm(formData, "local");
  const convidados = valueFromForm(formData, "convidados");
  const duracao = valueFromForm(formData, "duracao");
  const pacote = valueFromForm(formData, "pacote");
  const preferencias = valueFromForm(formData, "preferencias");
  const observacoes = valueFromForm(formData, "observacoes", "Sem observacoes por enquanto");

  return [
    "Ola, Mr. DROP! Gostaria de solicitar um orcamento.",
    "",
    `Nome: ${nome}`,
    `Tipo de evento: ${evento}`,
    `Data: ${data}`,
    `Local: ${local}`,
    `Convidados: ${convidados}`,
    `Duracao: ${duracao}`,
    `Pacote de interesse: ${pacote}`,
    `Preferencias de drinks: ${preferencias}`,
    `Observacoes: ${observacoes}`
  ].join("\n");
}

function updateMessagePreview() {
  if (!quoteForm || !messagePreview) return;
  messagePreview.value = buildWhatsAppMessage();
}

function getWhatsAppUrl(message) {
  const encodedMessage = encodeURIComponent(message);
  const cleanNumber = WHATSAPP_NUMBER.replace(/\D/g, "");

  if (cleanNumber) {
    return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
  }

  return `https://wa.me/?text=${encodedMessage}`;
}

function handleQuoteSubmit(event) {
  event.preventDefault();

  if (!quoteForm.reportValidity()) {
    return;
  }

  const message = buildWhatsAppMessage();
  messagePreview.value = message;
  window.open(getWhatsAppUrl(message), "_blank", "noopener,noreferrer");
}

async function copyMessage() {
  const message = buildWhatsAppMessage();
  messagePreview.value = message;

  try {
    await navigator.clipboard.writeText(message);
    formStatus.textContent = "Mensagem copiada.";
  } catch (error) {
    messagePreview.focus();
    messagePreview.select();
    formStatus.textContent = "Selecione a previa e copie manualmente.";
  }
}

function setupQuoteForm() {
  if (!quoteForm) return;

  quoteForm.addEventListener("input", updateMessagePreview);
  quoteForm.addEventListener("change", updateMessagePreview);
  quoteForm.addEventListener("submit", handleQuoteSubmit);
  copyButton.addEventListener("click", copyMessage);
  updateMessagePreview();
}

function prepareFutureAdminSlot() {
  const adminSlot = document.querySelector(futureAdmin.mountSelector);

  if (!adminSlot) return;

  adminSlot.dataset.adminReady = String(futureAdmin.enabled);
  adminSlot.dataset.adminRoutes = String(futureAdmin.routes.length);
}

window.addEventListener("scroll", updateQuickAccessMode, { passive: true });
window.addEventListener("resize", updateQuickAccessMode);

updateQuickAccessMode();
observeSections();
setupQuoteForm();
prepareFutureAdminSlot();
