const menuBtn = document.getElementById("mobile-menu-btn");
const menuPanel = document.getElementById("mobile-menu-panel");

if (menuBtn && menuPanel) {
  menuBtn.addEventListener("click", () => {
    const isOpen = menuPanel.classList.toggle("open");
    menuBtn.classList.toggle("open", isOpen);
    menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
}
