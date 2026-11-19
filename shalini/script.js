(() => {
  const root = document.documentElement;
  const body = document.body;
  const themeToggle = document.querySelector(".theme-toggle");
  const menuToggle = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".primary-navigation");
  const backToTop = document.querySelector(".back-to-top");
  const navigationLinks = Array.from(
    document.querySelectorAll(".primary-navigation .nav-link"),
  );
  const sections = navigationLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  themeToggle.hidden = false;

  function setTheme(theme, savePreference) {
    root.dataset.theme = theme;
    const nextTheme = theme === "dark" ? "light" : "dark";
    themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
    themeToggle.setAttribute("title", `Switch to ${nextTheme} mode`);
    document
      .querySelector('meta[name="theme-color"]')
      .setAttribute("content", theme === "dark" ? "#0b1421" : "#f5f8fc");

    if (savePreference) {
      try {
        window.localStorage.setItem("shalini-portfolio-theme", theme);
      } catch {
        // The theme still works for this visit if browser storage is unavailable.
      }
    }
  }

  try {
    const savedTheme = window.localStorage.getItem("shalini-portfolio-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme, false);
    }
  } catch {
    // Keep the light theme when browser storage is unavailable.
  }

  themeToggle.addEventListener("click", () => {
    setTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
  });

  function closeMenu() {
    navigation.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
  }

  menuToggle.hidden = false;
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    navigation.classList.toggle("is-open", !isOpen);
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    menuToggle.setAttribute(
      "aria-label",
      isOpen ? "Open navigation menu" : "Close navigation menu",
    );
  });

  navigationLinks.forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navigation.classList.contains("is-open")) {
      closeMenu();
      menuToggle.focus();
    }
  });

  function updateScrollControls() {
    backToTop.hidden = window.scrollY < 500;

    const pageBottom =
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - 4;
    let activeSection = pageBottom ? sections[sections.length - 1] : null;
    const activeLine = window.innerHeight * 0.36;

    if (!activeSection) {
      sections.forEach((section) => {
        if (section.getBoundingClientRect().top <= activeLine) {
          activeSection = section;
        }
      });
    }

    navigationLinks.forEach((link) => {
      if (activeSection && link.hash === `#${activeSection.id}`) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  let scrollUpdateScheduled = false;
  window.addEventListener(
    "scroll",
    () => {
      if (!scrollUpdateScheduled) {
        window.requestAnimationFrame(() => {
          updateScrollControls();
          scrollUpdateScheduled = false;
        });
        scrollUpdateScheduled = true;
      }
    },
    { passive: true },
  );

  backToTop.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: reducedMotion.matches ? "auto" : "smooth",
    });
  });

  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reducedMotion.matches) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -35px 0px" },
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  body.classList.add("js-enabled");
  updateScrollControls();
})();