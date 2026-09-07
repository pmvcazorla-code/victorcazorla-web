const menuBtn = document.getElementById("mobile-menu-btn");
const menuPanel = document.getElementById("mobile-menu-panel");

if (menuBtn && menuPanel) {
  // El panel cerrado se oculta visualmente con max-height:0, pero sin
  // `inert` sus enlaces siguen en el orden de tabulación y los anuncia
  // el lector de pantalla. Se marca inert al cerrar y se quita al abrir.
  // Lo hace el JS (no el HTML) para no empeorar el caso sin JS, donde el
  // menú no puede abrirse de todos modos.
  menuPanel.inert = true;

  const setOpen = (isOpen) => {
    menuPanel.classList.toggle("open", isOpen);
    menuBtn.classList.toggle("open", isOpen);
    menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    menuPanel.inert = !isOpen;
  };

  menuBtn.addEventListener("click", () => {
    setOpen(!menuPanel.classList.contains("open"));
  });

  // Escape cierra el menú y devuelve el foco al botón.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuPanel.classList.contains("open")) {
      setOpen(false);
      menuBtn.focus();
    }
  });
}
