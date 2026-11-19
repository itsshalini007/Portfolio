const contactForm = document.querySelector("#customer-contact-form");
const contactFormStatus = document.querySelector("#contact-form-status");

contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;

  const formData = new FormData(contactForm);
  const subject = String(formData.get("subject") ?? "").trim();
  const body = [
    `Name: ${String(formData.get("name") ?? "").trim()}`,
    `Mobile: ${String(formData.get("mobile") ?? "").trim()}`,
    `Email: ${String(formData.get("email") ?? "").trim() || "Not provided"}`,
    "",
    String(formData.get("message") ?? "").trim()
  ].join("\n");
  const mailto = `mailto:itsshalini007@gmail.com?${new URLSearchParams({ subject, body })}`;

  contactFormStatus.classList.remove("is-error");
  contactFormStatus.textContent = "Opening an email draft. The message has not been sent; review it and press Send in your email app.";
  window.location.href = mailto;
});
