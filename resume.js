const pdfjsLib = window.pdfjsLib;
const resumeCanvas = document.querySelector("#resume-page");
const canvasContext = resumeCanvas.getContext("2d");
const message = document.querySelector("#viewer-message");
const pageStatus = document.querySelector("#page-status");
const zoomStatus = document.querySelector("#zoom-status");
const previousButton = document.querySelector("#previous-page");
const nextButton = document.querySelector("#next-page");
const zoomOutButton = document.querySelector("#zoom-out");
const zoomInButton = document.querySelector("#zoom-in");

let pdfDocument;
let pageNumber = 1;
let zoom = 1;
let renderTask;
let renderSequence = 0;

function updateControls() {
  pageStatus.textContent = `Page ${pageNumber} of ${pdfDocument.numPages}`;
  zoomStatus.textContent = `${Math.round(zoom * 100)}%`;
  previousButton.disabled = pageNumber <= 1;
  nextButton.disabled = pageNumber >= pdfDocument.numPages;
  zoomOutButton.disabled = zoom <= 0.5;
  zoomInButton.disabled = zoom >= 2;
}

async function renderCurrentPage() {
  const sequence = ++renderSequence;
  const pendingRender = renderTask;
  if (pendingRender) {
    pendingRender.cancel();
    try {
      await pendingRender.promise;
    } catch (error) {
      if (error.name !== "RenderingCancelledException") {
        throw error;
      }
    }
    if (renderTask === pendingRender) {
      renderTask = undefined;
    }
  }

  const page = await pdfDocument.getPage(pageNumber);
  if (sequence !== renderSequence) {
    return;
  }

  const baseViewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(280, document.querySelector(".resume-viewer").clientWidth - 32);
  const fitScale = availableWidth / baseViewport.width;
  const viewport = page.getViewport({ scale: Math.min(zoom * fitScale, 2) });
  const pixelRatio = window.devicePixelRatio || 1;

  resumeCanvas.width = Math.floor(viewport.width * pixelRatio);
  resumeCanvas.height = Math.floor(viewport.height * pixelRatio);
  resumeCanvas.style.width = `${Math.floor(viewport.width)}px`;
  resumeCanvas.style.height = `${Math.floor(viewport.height)}px`;
  resumeCanvas.classList.add("is-visible");
  message.textContent = "";
  updateControls();

  const currentRender = page.render({
    canvasContext,
    viewport,
    transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0],
  });
  renderTask = currentRender;

  try {
    await currentRender.promise;
  } catch (error) {
    if (error.name !== "RenderingCancelledException") {
      throw error;
    }
  } finally {
    if (renderTask === currentRender) {
      renderTask = undefined;
    }
  }
}

function showError(error) {
  console.error("Unable to display the resume PDF.", error);
  resumeCanvas.classList.remove("is-visible");
  message.textContent = "The resume could not be loaded. Please try again later.";
  previousButton.disabled = true;
  nextButton.disabled = true;
  zoomOutButton.disabled = true;
  zoomInButton.disabled = true;
}

async function changePage(amount) {
  pageNumber = Math.min(Math.max(pageNumber + amount, 1), pdfDocument.numPages);
  try {
    await renderCurrentPage();
  } catch (error) {
    showError(error);
  }
}

async function changeZoom(amount) {
  zoom = Math.min(Math.max(zoom + amount, 0.5), 2);
  try {
    await renderCurrentPage();
  } catch (error) {
    showError(error);
  }
}

previousButton.addEventListener("click", () => changePage(-1));
nextButton.addEventListener("click", () => changePage(1));
zoomOutButton.addEventListener("click", () => changeZoom(-0.1));
zoomInButton.addEventListener("click", () => changeZoom(0.1));

if (!pdfjsLib) {
  showError(new Error("PDF.js failed to load."));
} else {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  pdfjsLib
    .getDocument("./assets/Harsh_Verma_Resume.pdf")
    .promise.then((document) => {
      pdfDocument = document;
      previousButton.disabled = false;
      nextButton.disabled = false;
      zoomOutButton.disabled = false;
      zoomInButton.disabled = false;
      return renderCurrentPage();
    })
    .catch(showError);
}

window.addEventListener("resize", () => {
  if (pdfDocument) {
    renderCurrentPage().catch(showError);
  }
});
