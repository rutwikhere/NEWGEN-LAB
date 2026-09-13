/**
 * Student ID Card Generator
 * NewGen IEDC - IIIT Allahabad
 * 
 * Pixel-precise template reproduction, dynamic text auto-fitting,
 * cover-crop photo handling with pan/zoom, and PNG/PDF export.
 */

// Master Canvas Constants matching exact reference design
const ID_CARD_WIDTH = 1011;
const ID_CARD_HEIGHT = 628;

// Default Field Positions & Calibration Metrics (Crisp Arial, Pure Black #000000)
const DEFAULT_CONFIG = {
  studentName: {
    x: 250,
    y: 327,
    maxWidth: 500,
    fontSize: 25,
    color: '#000000',
    fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif"
  },
  enrollmentNo: {
    x: 250,
    y: 389,
    maxWidth: 500,
    fontSize: 25,
    color: '#000000',
    fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif"
  },
  program: {
    x: 250,
    y: 451,
    maxWidth: 500,
    fontSize: 25,
    color: '#000000',
    fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif"
  },
  photo: {
    x: 767,
    y: 216,
    width: 201,
    height: 240
  }
};

// Current dynamic configuration (deep clone of defaults)
let activeConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

// Application State
const state = {
  studentName: '',
  enrollmentNo: '',
  program: '',
  photoImage: null,
  photoFileName: '',
  photoZoom: 1.0,
  photoPanX: 0,
  photoPanY: 0,
  currentNameFontSize: 25
};

// DOM Elements
const canvas = document.getElementById('idCardCanvas');
const ctx = canvas.getContext('2d');

// Retina / High-DPI Display Scaling (2x supersampling for pristine vector-sharp clarity)
const RENDER_SCALE = Math.max(2, Math.min(3, Math.round(window.devicePixelRatio || 2)));
canvas.width = ID_CARD_WIDTH * RENDER_SCALE;
canvas.height = ID_CARD_HEIGHT * RENDER_SCALE;

const studentNameInput = document.getElementById('studentNameInput');
const enrollmentInput = document.getElementById('enrollmentInput');
const programInput = document.getElementById('programInput');
const programSelect = document.getElementById('programSelect');
const otherProgramContainer = document.getElementById('otherProgramContainer');
const programOtherInput = document.getElementById('programOtherInput');
const photoInput = document.getElementById('photoInput');
const dropZone = document.getElementById('dropZone');
const dropZonePrompt = document.getElementById('dropZonePrompt');
const dropZoneInfo = document.getElementById('dropZoneInfo');
const thumbPreview = document.getElementById('thumbPreview');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const fileDimensionsDisplay = document.getElementById('fileDimensionsDisplay');
const btnRemovePhoto = document.getElementById('btnRemovePhoto');

// Selectable DOM Card Elements
const domStudentName = document.getElementById('domStudentName');
const domEnrollmentNo = document.getElementById('domEnrollmentNo');
const domProgram = document.getElementById('domProgram');
const domPhotoImg = document.getElementById('domPhotoImg');
const domPhotoPlaceholder = document.getElementById('domPhotoPlaceholder');
const cardHeaderImg = document.getElementById('cardHeaderImg');

const photoAdjustmentCard = document.getElementById('photoAdjustmentCard');
const photoZoom = document.getElementById('photoZoom');
const photoPanX = document.getElementById('photoPanX');
const photoPanY = document.getElementById('photoPanY');
const zoomValue = document.getElementById('zoomValue');
const panXValue = document.getElementById('panXValue');
const panYValue = document.getElementById('panYValue');
const btnResetPhotoAdj = document.getElementById('btnResetPhotoAdj');

const btnDownloadPNG = document.getElementById('btnDownloadPNG');
const btnDownloadPDF = document.getElementById('btnDownloadPDF');
const validationAlert = document.getElementById('validationAlert');
const validationMessage = document.getElementById('validationMessage');
const fontSizeIndicator = document.getElementById('fontSizeIndicator');



// Calibration Accordion Elements
const btnToggleCalibration = document.getElementById('btnToggleCalibration');
const calibrationBody = document.getElementById('calibrationBody');
const calibrationChevron = document.getElementById('calibrationChevron');
const btnResetCalibration = document.getElementById('btnResetCalibration');

const calibNameX = document.getElementById('calibNameX');
const calibNameY = document.getElementById('calibNameY');
const calibNameMaxW = document.getElementById('calibNameMaxW');
const calibNameSize = document.getElementById('calibNameSize');

const calibEnrollX = document.getElementById('calibEnrollX');
const calibEnrollY = document.getElementById('calibEnrollY');
const calibEnrollMaxW = document.getElementById('calibEnrollMaxW');
const calibEnrollSize = document.getElementById('calibEnrollSize');

const calibProgX = document.getElementById('calibProgX');
const calibProgY = document.getElementById('calibProgY');
const calibProgMaxW = document.getElementById('calibProgMaxW');
const calibProgSize = document.getElementById('calibProgSize');

const calibPhotoX = document.getElementById('calibPhotoX');
const calibPhotoY = document.getElementById('calibPhotoY');
const calibPhotoW = document.getElementById('calibPhotoW');
const calibPhotoH = document.getElementById('calibPhotoH');

// Master Template Image instance (Clean card background with official header)
const templateImage = new Image();
let isTemplateLoaded = false;

templateImage.onload = () => {
  isTemplateLoaded = true;
  renderCard();
};
templateImage.onerror = (err) => {
  console.error('Failed to load card background image:', err);
  showToast('Failed to load card background image.', 'error');
};

const bgSrc = (window.EMBEDDED_ASSETS && window.EMBEDDED_ASSETS.cardBg) || 'assets/card-bg.png';
templateImage.src = bgSrc;
if (cardHeaderImg) {
  cardHeaderImg.src = bgSrc;
}

// ==========================================================================
// Text Auto-Fitting Algorithm
// ==========================================================================

/**
 * Dynamically measures and calculates the font size required to fit text
 * within maxWidth strictly on a single line.
 * 
 * @param {CanvasRenderingContext2D} ctx 
 * @param {string} text 
 * @param {number} maxWidth 
 * @param {number} startFontSize 
 * @param {number} minFontSize 
 * @param {string} fontFamily 
 * @returns {number} Fitted font size
 */
function fitTextToWidth(ctx, text, maxWidth, startFontSize = 25, minFontSize = 11, fontFamily = "Arial, 'Helvetica Neue', Helvetica, sans-serif") {
  if (!text || text.trim() === '') return startFontSize;
  
  let fontSize = startFontSize;
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  let textWidth = ctx.measureText(text).width;

  while (textWidth > maxWidth && fontSize > minFontSize) {
    fontSize -= 0.5;
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    textWidth = ctx.measureText(text).width;
  }

  return fontSize;
}

// ==========================================================================
// Canvas Drawing Functions
// ==========================================================================

/**
 * Draws the base template image (clean header + white canvas).
 */
function drawTemplate() {
  if (isTemplateLoaded) {
    ctx.drawImage(templateImage, 0, 0, ID_CARD_WIDTH, ID_CARD_HEIGHT);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ID_CARD_WIDTH, ID_CARD_HEIGHT);
  }
}

/**
 * Draws static text and lines onto canvas for 1011x628 PNG export.
 */
function drawStaticCardText() {
  ctx.save();

  // LAB ACCESS CARD Heading
  ctx.font = "bold 25px Arial, 'Helvetica Neue', Helvetica, sans-serif";
  ctx.fillStyle = '#2e3192';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('LAB ACCESS CARD', 505, 182);

  // Underline
  ctx.strokeStyle = '#2e3192';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(380, 192);
  ctx.lineTo(638, 192);
  ctx.stroke();

  // Red authorization paragraph
  ctx.font = "17.5px Arial, 'Helvetica Neue', Helvetica, sans-serif";
  ctx.fillStyle = '#e11d24';
  ctx.textAlign = 'left';
  ctx.fillText('This card authorizes the holder to access the New Gen IEDC Laboratory with', 39, 236);
  ctx.fillText('the permission of Dr. Ranjana Vyas, Coordinator – New Gen IEDC.', 39, 258);

  // Field Labels (at X = 40)
  ctx.font = "bold 25px Arial, 'Helvetica Neue', Helvetica, sans-serif";
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Student Name', 40, 327);
  ctx.fillText('Enrollment No.', 40, 389);
  ctx.fillText('Program', 40, 451);

  // Colons (vertically aligned at X = 226 matching reference template)
  ctx.fillText(':', 226, 327);
  ctx.fillText(':', 226, 389);
  ctx.fillText(':', 226, 451);

  // Signatures & Footer
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;

  // Student Signature line
  ctx.beginPath();
  ctx.moveTo(40, 568);
  ctx.lineTo(240, 568);
  ctx.stroke();

  ctx.font = "bold 16px Arial, 'Helvetica Neue', Helvetica, sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('Student Signature', 140, 584);
  ctx.font = "14px Arial, 'Helvetica Neue', Helvetica, sans-serif";
  ctx.fillText('(Holder)', 140, 600);

  // Center address
  ctx.font = "16px Arial, 'Helvetica Neue', Helvetica, sans-serif";
  ctx.fillText('CC2, Room 4305, IIIT Allahabad', 665, 598);

  // Prof Signature line
  ctx.beginPath();
  ctx.moveTo(767, 568);
  ctx.lineTo(967, 568);
  ctx.stroke();

  ctx.font = "bold 16px Arial, 'Helvetica Neue', Helvetica, sans-serif";
  ctx.fillText('Prof. Signature', 867, 584);
  ctx.font = "14px Arial, 'Helvetica Neue', Helvetica, sans-serif";
  ctx.fillText('(Dr. Ranjana Vyas)', 867, 600);

  ctx.restore();
}

/**
 * Draws Student Name with auto-fit font sizing.
 */
function drawStudentName() {
  if (!state.studentName || state.studentName.trim() === '') return;

  const cfg = activeConfig.studentName;
  const safeMaxWidth = Math.min(cfg.maxWidth, (activeConfig.photo.x - cfg.x - 12));
  
  const fittedSize = fitTextToWidth(ctx, state.studentName, safeMaxWidth, cfg.fontSize, 11, cfg.fontFamily);
  state.currentNameFontSize = fittedSize;
  fontSizeIndicator.textContent = `Name Font: ${fittedSize}px`;

  ctx.save();
  ctx.font = `bold ${fittedSize}px ${cfg.fontFamily}`;
  ctx.fillStyle = cfg.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(state.studentName, cfg.x, cfg.y);
  ctx.restore();
}

/**
 * Draws Enrollment Number with auto-fit safety.
 */
function drawEnrollmentNumber() {
  if (!state.enrollmentNo || state.enrollmentNo.trim() === '') return;

  const cfg = activeConfig.enrollmentNo;
  const safeMaxWidth = Math.min(cfg.maxWidth, (activeConfig.photo.x - cfg.x - 12));
  
  const fittedSize = fitTextToWidth(ctx, state.enrollmentNo, safeMaxWidth, cfg.fontSize, 11, cfg.fontFamily);

  ctx.save();
  ctx.font = `bold ${fittedSize}px ${cfg.fontFamily}`;
  ctx.fillStyle = cfg.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(state.enrollmentNo, cfg.x, cfg.y);
  ctx.restore();
}

/**
 * Draws Program with auto-fit safety.
 */
function drawProgram() {
  if (!state.program || state.program.trim() === '') return;

  const cfg = activeConfig.program;
  const safeMaxWidth = Math.min(cfg.maxWidth, (activeConfig.photo.x - cfg.x - 12));
  
  const fittedSize = fitTextToWidth(ctx, state.program, safeMaxWidth, cfg.fontSize, 11, cfg.fontFamily);

  ctx.save();
  ctx.font = `bold ${fittedSize}px ${cfg.fontFamily}`;
  ctx.fillStyle = cfg.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(state.program, cfg.x, cfg.y);
  ctx.restore();
}

/**
 * Draws Student Photo inside the exact fixed photo container using cover-fit,
 * zoom factor, and pan offsets.
 */
function drawStudentPhoto() {
  const pCfg = activeConfig.photo;

  if (!state.photoImage) {
    ctx.save();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(pCfg.x, pCfg.y, pCfg.width, pCfg.height);
    ctx.restore();
    return;
  }

  ctx.save();
  
  // 1. Set clipping path strictly to photo box
  ctx.beginPath();
  ctx.rect(pCfg.x, pCfg.y, pCfg.width, pCfg.height);
  ctx.clip();

  // 2. Clear photo area to pure white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(pCfg.x, pCfg.y, pCfg.width, pCfg.height);

  // 3. Compute object-fit: cover scaling
  const img = state.photoImage;
  const containerW = pCfg.width;
  const containerH = pCfg.height;
  const containerAspect = containerW / containerH;
  const imgAspect = img.width / img.height;

  let baseW, baseH;
  if (imgAspect > containerAspect) {
    baseH = containerH;
    baseW = baseH * imgAspect;
  } else {
    baseW = containerW;
    baseH = baseW / imgAspect;
  }

  const renderW = baseW * state.photoZoom;
  const renderH = baseH * state.photoZoom;

  const posX = pCfg.x + (containerW - renderW) / 2 + state.photoPanX;
  const posY = pCfg.y + (containerH - renderH) / 2 + state.photoPanY;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, posX, posY, renderW, renderH);

  ctx.restore();
}

/**
 * Master render function. Synchronizes both the native selectable HTML/CSS card
 * and the high-DPI master canvas.
 */
function renderCard() {
  // 1. Update Native Selectable DOM Card
  if (domStudentName) {
    domStudentName.textContent = state.studentName;
    const safeMaxWidth = Math.min(activeConfig.studentName.maxWidth, (activeConfig.photo.x - activeConfig.studentName.x - 12));
    const fittedSize = fitTextToWidth(ctx, state.studentName, safeMaxWidth, activeConfig.studentName.fontSize, 11, activeConfig.studentName.fontFamily);
    state.currentNameFontSize = fittedSize;
    const cqw = (fittedSize / ID_CARD_WIDTH) * 100;
    domStudentName.style.fontSize = `${cqw}cqw`;
  }
  if (domEnrollmentNo) {
    domEnrollmentNo.textContent = state.enrollmentNo;
    const safeMaxWidth = Math.min(activeConfig.enrollmentNo.maxWidth, (activeConfig.photo.x - activeConfig.enrollmentNo.x - 12));
    const fittedSize = fitTextToWidth(ctx, state.enrollmentNo, safeMaxWidth, activeConfig.enrollmentNo.fontSize, 11, activeConfig.enrollmentNo.fontFamily);
    const cqw = (fittedSize / ID_CARD_WIDTH) * 100;
    domEnrollmentNo.style.fontSize = `${cqw}cqw`;
  }
  if (domProgram) {
    domProgram.textContent = state.program;
    const safeMaxWidth = Math.min(activeConfig.program.maxWidth, (activeConfig.photo.x - activeConfig.program.x - 12));
    const fittedSize = fitTextToWidth(ctx, state.program, safeMaxWidth, activeConfig.program.fontSize, 11, activeConfig.program.fontFamily);
    const cqw = (fittedSize / ID_CARD_WIDTH) * 100;
    domProgram.style.fontSize = `${cqw}cqw`;
  }
  if (domPhotoImg) {
    if (state.photoImage) {
      domPhotoImg.src = state.photoImage.src;
      domPhotoImg.style.transform = `scale(${state.photoZoom}) translate(${state.photoPanX}px, ${state.photoPanY}px)`;
      domPhotoImg.classList.remove('hidden');
      if (domPhotoPlaceholder) domPhotoPlaceholder.classList.add('hidden');
    } else {
      domPhotoImg.classList.add('hidden');
      if (domPhotoPlaceholder) domPhotoPlaceholder.classList.remove('hidden');
    }
  }

  // 2. Render onto high-DPI canvas (for pixel-perfect PNG export)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  drawTemplate();
  drawStaticCardText();
  drawStudentPhoto();
  drawStudentName();
  drawEnrollmentNumber();
  drawProgram();

  ctx.restore();
}

// ==========================================================================
// Image Upload & Dropzone Handling
// ==========================================================================

function handlePhotoFile(file) {
  if (!file) return;

  if (!file.type.match('image.*')) {
    showToast('Please select a valid image file (JPG, JPEG, PNG).', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      state.photoImage = img;
      state.photoFileName = file.name;
      state.photoZoom = 1.0;
      state.photoPanX = 0;
      state.photoPanY = 0;

      // Update UI
      photoZoom.value = 1.0;
      photoPanX.value = 0;
      photoPanY.value = 0;
      zoomValue.textContent = '1.0x';
      panXValue.textContent = '0px';
      panYValue.textContent = '0px';

      thumbPreview.src = e.target.result;
      fileNameDisplay.textContent = file.name;
      fileDimensionsDisplay.textContent = `${img.width} × ${img.height} px`;

      dropZonePrompt.classList.add('hidden');
      dropZoneInfo.classList.remove('hidden');
      photoAdjustmentCard.classList.remove('hidden');

      renderCard();
      hideValidationAlert();
      showToast('Photo uploaded successfully!', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removePhoto() {
  state.photoImage = null;
  state.photoFileName = '';
  photoInput.value = '';
  dropZonePrompt.classList.remove('hidden');
  dropZoneInfo.classList.add('hidden');
  photoAdjustmentCard.classList.add('hidden');
  renderCard();
}

// Drag & drop listeners
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handlePhotoFile(e.dataTransfer.files[0]);
  }
});

photoInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handlePhotoFile(e.target.files[0]);
  }
});

btnRemovePhoto.addEventListener('click', (e) => {
  e.stopPropagation();
  removePhoto();
});

// Photo adjustment listeners
photoZoom.addEventListener('input', (e) => {
  state.photoZoom = parseFloat(e.target.value);
  zoomValue.textContent = `${state.photoZoom.toFixed(2)}x`;
  renderCard();
});

photoPanX.addEventListener('input', (e) => {
  state.photoPanX = parseInt(e.target.value, 10);
  panXValue.textContent = `${state.photoPanX}px`;
  renderCard();
});

photoPanY.addEventListener('input', (e) => {
  state.photoPanY = parseInt(e.target.value, 10);
  panYValue.textContent = `${state.photoPanY}px`;
  renderCard();
});

btnResetPhotoAdj.addEventListener('click', () => {
  state.photoZoom = 1.0;
  state.photoPanX = 0;
  state.photoPanY = 0;
  photoZoom.value = 1.0;
  photoPanX.value = 0;
  photoPanY.value = 0;
  zoomValue.textContent = '1.0x';
  panXValue.textContent = '0px';
  panYValue.textContent = '0px';
  renderCard();
});

// ==========================================================================
// Form Input Reactivity
// ==========================================================================

studentNameInput.addEventListener('input', (e) => {
  state.studentName = e.target.value;
  renderCard();
  hideValidationAlert();
});

enrollmentInput.addEventListener('input', (e) => {
  state.enrollmentNo = e.target.value;
  renderCard();
  hideValidationAlert();
});

if (programSelect) {
  programSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'other') {
      otherProgramContainer.classList.remove('hidden');
      programOtherInput.focus();
      state.program = programOtherInput.value.trim();
      programInput.value = state.program;
    } else {
      otherProgramContainer.classList.add('hidden');
      programOtherInput.value = '';
      state.program = val;
      programInput.value = val;
    }
    renderCard();
    hideValidationAlert();
  });
}

if (programOtherInput) {
  programOtherInput.addEventListener('input', (e) => {
    state.program = e.target.value;
    programInput.value = e.target.value;
    renderCard();
    hideValidationAlert();
  });
}

programInput.addEventListener('input', (e) => {
  state.program = e.target.value;
  renderCard();
  hideValidationAlert();
});

// ==========================================================================
// Quick Presets
// ==========================================================================

function applyPreset(name, enroll, prog) {
  state.studentName = name;
  state.enrollmentNo = enroll;
  state.program = prog;

  studentNameInput.value = name;
  enrollmentInput.value = enroll;
  programInput.value = prog;

  if (programSelect) {
    if (prog === 'B.Tech IT' || prog === 'B.Tech IT-Bin' || prog === 'B.Tech ECE') {
      programSelect.value = prog;
      if (otherProgramContainer) otherProgramContainer.classList.add('hidden');
      if (programOtherInput) programOtherInput.value = '';
    } else if (prog) {
      programSelect.value = 'other';
      if (otherProgramContainer) otherProgramContainer.classList.remove('hidden');
      if (programOtherInput) programOtherInput.value = prog;
    } else {
      programSelect.value = '';
      if (otherProgramContainer) otherProgramContainer.classList.add('hidden');
      if (programOtherInput) programOtherInput.value = '';
    }
  }

  renderCard();
  hideValidationAlert();
  showToast(`Loaded preset: ${name}`, 'info');
}

function loadPresetPhoto(src, filename) {
  let finalSrc = src;
  if (filename === 'sample-portrait.jpg' && window.EMBEDDED_ASSETS && window.EMBEDDED_ASSETS.samplePortrait) {
    finalSrc = window.EMBEDDED_ASSETS.samplePortrait;
  } else if (filename === 'sample-landscape.png' && window.EMBEDDED_ASSETS && window.EMBEDDED_ASSETS.sampleLandscape) {
    finalSrc = window.EMBEDDED_ASSETS.sampleLandscape;
  }

  const img = new Image();
  img.onload = () => {
    state.photoImage = img;
    state.photoFileName = filename;
    state.photoZoom = 1.0;
    state.photoPanX = 0;
    state.photoPanY = 0;

    photoZoom.value = 1.0;
    photoPanX.value = 0;
    photoPanY.value = 0;
    zoomValue.textContent = '1.0x';
    panXValue.textContent = '0px';
    panYValue.textContent = '0px';

    thumbPreview.src = finalSrc;
    fileNameDisplay.textContent = filename;
    fileDimensionsDisplay.textContent = `${img.width} × ${img.height} px`;

    dropZonePrompt.classList.add('hidden');
    dropZoneInfo.classList.remove('hidden');
    photoAdjustmentCard.classList.remove('hidden');

    renderCard();
    hideValidationAlert();
  };
  img.src = finalSrc;
}




// ==========================================================================
// Template Calibration Tool
// ==========================================================================

btnToggleCalibration.addEventListener('click', () => {
  const isHidden = calibrationBody.classList.contains('hidden');
  if (isHidden) {
    calibrationBody.classList.remove('hidden');
    calibrationChevron.classList.add('open');
    btnToggleCalibration.setAttribute('aria-expanded', 'true');
  } else {
    calibrationBody.classList.add('hidden');
    calibrationChevron.classList.remove('open');
    btnToggleCalibration.setAttribute('aria-expanded', 'false');
  }
});

function syncCalibrationInputs() {
  calibNameX.value = activeConfig.studentName.x;
  calibNameY.value = activeConfig.studentName.y;
  calibNameMaxW.value = activeConfig.studentName.maxWidth;
  calibNameSize.value = activeConfig.studentName.fontSize;

  calibEnrollX.value = activeConfig.enrollmentNo.x;
  calibEnrollY.value = activeConfig.enrollmentNo.y;
  calibEnrollMaxW.value = activeConfig.enrollmentNo.maxWidth;
  calibEnrollSize.value = activeConfig.enrollmentNo.fontSize;

  calibProgX.value = activeConfig.program.x;
  calibProgY.value = activeConfig.program.y;
  calibProgMaxW.value = activeConfig.program.maxWidth;
  calibProgSize.value = activeConfig.program.fontSize;

  calibPhotoX.value = activeConfig.photo.x;
  calibPhotoY.value = activeConfig.photo.y;
  calibPhotoW.value = activeConfig.photo.width;
  calibPhotoH.value = activeConfig.photo.height;
}

function attachCalibListener(inputElem, setterFn) {
  inputElem.addEventListener('input', () => {
    setterFn(parseFloat(inputElem.value) || 0);
    renderCard();
  });
}

attachCalibListener(calibNameX, v => activeConfig.studentName.x = v);
attachCalibListener(calibNameY, v => activeConfig.studentName.y = v);
attachCalibListener(calibNameMaxW, v => activeConfig.studentName.maxWidth = v);
attachCalibListener(calibNameSize, v => activeConfig.studentName.fontSize = v);

attachCalibListener(calibEnrollX, v => activeConfig.enrollmentNo.x = v);
attachCalibListener(calibEnrollY, v => activeConfig.enrollmentNo.y = v);
attachCalibListener(calibEnrollMaxW, v => activeConfig.enrollmentNo.maxWidth = v);
attachCalibListener(calibEnrollSize, v => activeConfig.enrollmentNo.fontSize = v);

attachCalibListener(calibProgX, v => activeConfig.program.x = v);
attachCalibListener(calibProgY, v => activeConfig.program.y = v);
attachCalibListener(calibProgMaxW, v => activeConfig.program.maxWidth = v);
attachCalibListener(calibProgSize, v => activeConfig.program.fontSize = v);

attachCalibListener(calibPhotoX, v => activeConfig.photo.x = v);
attachCalibListener(calibPhotoY, v => activeConfig.photo.y = v);
attachCalibListener(calibPhotoW, v => activeConfig.photo.width = v);
attachCalibListener(calibPhotoH, v => activeConfig.photo.height = v);

btnResetCalibration.addEventListener('click', () => {
  activeConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  syncCalibrationInputs();
  renderCard();
  showToast('Coordinates reset to default template alignment.', 'info');
});

syncCalibrationInputs();

// ==========================================================================
// Form Validation & Exports (PNG & PDF)
// ==========================================================================

/**
 * Universal file download helper that works reliably across Chrome, Brave,
 * Firefox, Safari, Edge, and supports both Blob and DataURL.
 */
function downloadFile(blobOrUrl, filename) {
  if (typeof blobOrUrl === 'string') {
    // Data URL
    const a = document.createElement('a');
    a.href = blobOrUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) document.body.removeChild(a);
    }, 1000);
    return;
  }

  // Blob Object
  const blobUrl = URL.createObjectURL(blobOrUrl);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }, 3000);
}

function validateForm() {
  // Always synchronize state directly from the DOM input values
  state.studentName = (studentNameInput.value || '').trim();
  state.enrollmentNo = (enrollmentInput.value || '').trim();
  
  if (programSelect && programSelect.value === 'other') {
    state.program = (programOtherInput ? programOtherInput.value : '').trim();
  } else if (programSelect && programSelect.value) {
    state.program = programSelect.value.trim();
  } else {
    state.program = (programInput.value || '').trim();
  }
  programInput.value = state.program;

  const missing = [];
  if (!state.studentName) {
    missing.push('Student Name');
    studentNameInput.classList.add('input-error');
  } else {
    studentNameInput.classList.remove('input-error');
  }

  if (!state.enrollmentNo) {
    missing.push('Enrollment No.');
    enrollmentInput.classList.add('input-error');
  } else {
    enrollmentInput.classList.remove('input-error');
  }

  if (!state.program) {
    missing.push('Program');
    if (programSelect && programSelect.value === 'other' && programOtherInput) {
      programOtherInput.classList.add('input-error');
    } else if (programSelect) {
      programSelect.classList.add('input-error');
    } else {
      programInput.classList.add('input-error');
    }
  } else {
    programInput.classList.remove('input-error');
    if (programSelect) programSelect.classList.remove('input-error');
    if (programOtherInput) programOtherInput.classList.remove('input-error');
  }

  if (!state.photoImage) {
    missing.push('Student Photo');
    dropZone.classList.add('input-error');
  } else {
    dropZone.classList.remove('input-error');
  }

  if (missing.length > 0) {
    const message = `Please provide: ${missing.join(', ')}.`;
    showValidationAlert(message);
    showToast(message, 'warning', 4500);
    return false;
  }

  hideValidationAlert();
  return true;
}

function showValidationAlert(message) {
  validationMessage.textContent = message;
  validationAlert.classList.remove('hidden');
}

function hideValidationAlert() {
  validationAlert.classList.add('hidden');
  studentNameInput.classList.remove('input-error');
  enrollmentInput.classList.remove('input-error');
  programInput.classList.remove('input-error');
  if (programSelect) programSelect.classList.remove('input-error');
  if (programOtherInput) programOtherInput.classList.remove('input-error');
  dropZone.classList.remove('input-error');
}

function getSanitizedFilename(ext) {
  const cleanEnrollment = (state.enrollmentNo || 'ID').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanName = (state.studentName || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `StudentID_${cleanEnrollment}_${cleanName}.${ext}`;
}

// Download PNG Handler (Exact 1011 × 628 px with Supersampled Clarity)
btnDownloadPNG.addEventListener('click', () => {
  try {
    if (!validateForm()) return;

    renderCard();

    // Create clean export canvas at exact 1011 × 628 resolution
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = ID_CARD_WIDTH;
    exportCanvas.height = ID_CARD_HEIGHT;
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.imageSmoothingEnabled = true;
    exportCtx.imageSmoothingQuality = 'high';
    // Supersampled downscale from high-res buffer to exact 1011x628
    exportCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, ID_CARD_WIDTH, ID_CARD_HEIGHT);

    const filename = getSanitizedFilename('png');

    if (exportCanvas.toBlob) {
      exportCanvas.toBlob((blob) => {
        if (blob) {
          downloadFile(blob, filename);
        } else {
          // Fallback to dataURL if toBlob returns null
          const dataUrl = exportCanvas.toDataURL('image/png', 1.0);
          downloadFile(dataUrl, filename);
        }
        showToast(`Downloaded ID Card PNG (${ID_CARD_WIDTH} × ${ID_CARD_HEIGHT} px)`, 'success');
      }, 'image/png');
    } else {
      const dataUrl = exportCanvas.toDataURL('image/png', 1.0);
      downloadFile(dataUrl, filename);
      showToast(`Downloaded ID Card PNG (${ID_CARD_WIDTH} × ${ID_CARD_HEIGHT} px)`, 'success');
    }
  } catch (err) {
    console.error('PNG download error:', err);
    showToast('Failed to export PNG: ' + err.message, 'error');
  }
});

// Download PDF Handler (100% Selectable Vector Typography & Crisp Graphics)
btnDownloadPDF.addEventListener('click', () => {
  try {
    if (!validateForm()) return;

    renderCard();

    const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFClass) {
      showToast('PDF generation library not found. Please reload the page.', 'error');
      return;
    }

    // Create landscape PDF with exact 1011 × 628 aspect ratio
    const pdf = new jsPDFClass({
      orientation: 'landscape',
      unit: 'pt',
      format: [ID_CARD_WIDTH, ID_CARD_HEIGHT],
      compress: true
    });

    // 1. Add official clean header banner (logos & dark blue bar)
    const bgUrl = (window.EMBEDDED_ASSETS && window.EMBEDDED_ASSETS.cardBg) || 'assets/card-bg.png';
    pdf.addImage(bgUrl, 'PNG', 0, 0, ID_CARD_WIDTH, ID_CARD_HEIGHT, undefined, 'FAST');

    // 2. Add student photo if present
    const pCfg = activeConfig.photo;
    if (state.photoImage) {
      const tempPhotoCanvas = document.createElement('canvas');
      tempPhotoCanvas.width = pCfg.width * 2;
      tempPhotoCanvas.height = pCfg.height * 2;
      const pCtx = tempPhotoCanvas.getContext('2d');
      pCtx.scale(2, 2);

      const img = state.photoImage;
      const containerW = pCfg.width;
      const containerH = pCfg.height;
      const containerAspect = containerW / containerH;
      const imgAspect = img.width / img.height;

      let baseW, baseH;
      if (imgAspect > containerAspect) {
        baseH = containerH;
        baseW = baseH * imgAspect;
      } else {
        baseW = containerW;
        baseH = baseW / imgAspect;
      }

      const renderW = baseW * state.photoZoom;
      const renderH = baseH * state.photoZoom;
      const posX = (containerW - renderW) / 2 + state.photoPanX;
      const posY = (containerH - renderH) / 2 + state.photoPanY;

      pCtx.imageSmoothingEnabled = true;
      pCtx.imageSmoothingQuality = 'high';
      pCtx.drawImage(img, posX, posY, renderW, renderH);

      const photoDataUrl = tempPhotoCanvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(photoDataUrl, 'JPEG', pCfg.x, pCfg.y, pCfg.width, pCfg.height, undefined, 'FAST');
    } else {
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(1);
      pdf.rect(pCfg.x, pCfg.y, pCfg.width, pCfg.height);
    }

    // 3. Genuine Selectable Vector Typography
    // LAB ACCESS CARD Heading
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18.5);
    pdf.setTextColor(46, 49, 146);
    pdf.text('LAB ACCESS CARD', 505, 182, { align: 'center' });

    pdf.setDrawColor(46, 49, 146);
    pdf.setLineWidth(1.5);
    pdf.line(380, 192, 638, 192);

    // Red authorization paragraph
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(13);
    pdf.setTextColor(225, 29, 36);
    pdf.text('This card authorizes the holder to access the New Gen IEDC Laboratory with', 39, 236);
    pdf.text('the permission of Dr. Ranjana Vyas, Coordinator – New Gen IEDC.', 39, 258);

    // Field Labels (at X = 40)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Student Name', 40, 327);
    pdf.text('Enrollment No.', 40, 389);
    pdf.text('Program', 40, 451);

    // Colons (vertically aligned at X = 226 matching reference template)
    pdf.text(':', 226, 327);
    pdf.text(':', 226, 389);
    pdf.text(':', 226, 451);

    // Dynamic Student Details (Actual selectable vector text at X = 250)
    const namePt = (state.currentNameFontSize || 25) * 0.75;
    pdf.setFontSize(namePt);
    pdf.text(state.studentName || '', 250, 327);

    const safeMaxWidthEnroll = Math.min(activeConfig.enrollmentNo.maxWidth, (activeConfig.photo.x - activeConfig.enrollmentNo.x - 12));
    const enrollSize = fitTextToWidth(ctx, state.enrollmentNo, safeMaxWidthEnroll, activeConfig.enrollmentNo.fontSize, 11, activeConfig.enrollmentNo.fontFamily);
    pdf.setFontSize(enrollSize * 0.75);
    pdf.text(state.enrollmentNo || '', 250, 389);

    const safeMaxWidthProg = Math.min(activeConfig.program.maxWidth, (activeConfig.photo.x - activeConfig.program.x - 12));
    const progSize = fitTextToWidth(ctx, state.program, safeMaxWidthProg, activeConfig.program.fontSize, 11, activeConfig.program.fontFamily);
    pdf.setFontSize(progSize * 0.75);
    pdf.text(state.program || '', 250, 451);

    // Signatures and Footer
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(1.2);
    // Student signature line
    pdf.line(40, 568, 240, 568);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Student Signature', 140, 584, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10.5);
    pdf.text('(Holder)', 140, 600, { align: 'center' });

    // Middle footer address
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text('CC2, Room 4305, IIIT Allahabad', 665, 598, { align: 'center' });

    // Prof signature line
    pdf.line(767, 568, 967, 568);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Prof. Signature', 867, 584, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10.5);
    pdf.text('(Dr. Ranjana Vyas)', 867, 600, { align: 'center' });

    const filename = getSanitizedFilename('pdf');
    
    // Blob download
    try {
      const pdfBlob = pdf.output('blob');
      downloadFile(pdfBlob, filename);
    } catch (outputErr) {
      pdf.save(filename);
    }

    showToast('Downloaded selectable vector PDF card!', 'success');
  } catch (err) {
    console.error('PDF generation error:', err);
    showToast('Failed to export PDF: ' + err.message, 'error');
  }
});

// ==========================================================================
// Toast Notification Utility
// ==========================================================================

const toastContainer = document.getElementById('toastContainer');

function showToast(message, type = 'info', duration = 3500) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '✓',
    warning: '⚠',
    error: '✕',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <span style="font-weight: 700;">${icons[type] || 'ℹ'}</span>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }, duration);
}

// Initial default preset pre-load and URL query param support for testing
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const testMode = urlParams.get('test');

  if (testMode === 'user_rutwik') {
    applyPreset('Rutwik Wakale', 'IIB2024004', 'B.Tech IT');
    loadPresetPhoto('assets/sample-portrait.jpg', 'sample-portrait.jpg');
  } else if (testMode === 'canvas_view') {
    applyPreset('Rutwik Wakale', 'IIB2024004', 'B.Tech IT');
    loadPresetPhoto('assets/sample-portrait.jpg', 'sample-portrait.jpg');
    // Reveal canvas and hide DOM layer so screenshot shows raw canvas rendering
    canvas.classList.remove('hidden-canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    const domLayer = document.getElementById('cardContentLayer');
    if (domLayer) domLayer.style.display = 'none';
    const headerBg = document.getElementById('cardHeaderImg');
    if (headerBg) headerBg.style.display = 'none';
  } else if (testMode === 'dropdown_itbin') {
    applyPreset('Rahul Sharma', 'IIT2023045', 'B.Tech IT-Bin');
    loadPresetPhoto('assets/sample-portrait.jpg', 'sample-portrait.jpg');
  } else if (testMode === 'dropdown_other') {
    applyPreset('Priya Singh', 'IIT2024099', 'M.Tech (Bioinformatics)');
    loadPresetPhoto('assets/sample-portrait.jpg', 'sample-portrait.jpg');
  } else if (testMode === 'very_long') {
    applyPreset('Rahul Kumar Sharma Very Long Student Name', 'MSCL2022099', 'M.Tech (Cyber Security & Cloud Computing)');
    loadPresetPhoto('assets/sample-portrait.jpg', 'sample-portrait.jpg');
  } else if (testMode === 'short') {
    applyPreset('Amit Roy', 'IIT2024012', 'B.Tech (ECE)');
    loadPresetPhoto('assets/sample-portrait.jpg', 'sample-portrait.jpg');
  } else if (testMode === 'long_enroll') {
    applyPreset('Priyanka Chidambaram', 'IIT2023001-EXT-HONORS', 'Dual Degree B.Tech + M.Tech (IT)');
    loadPresetPhoto('assets/sample-portrait.jpg', 'sample-portrait.jpg');
  } else if (testMode === 'landscape') {
    applyPreset('Rahul Sharma', 'IIT2023045', 'B.Tech (Information Technology)');
    loadPresetPhoto('assets/sample-landscape.png', 'sample-landscape.png');
  } else if (testMode === 'calibration') {
    applyPreset('Rahul Sharma', 'IIT2023045', 'B.Tech (Information Technology)');
    loadPresetPhoto('assets/sample-portrait.jpg', 'sample-portrait.jpg');
    calibrationBody.classList.remove('hidden');
    calibrationChevron.classList.add('open');
    btnToggleCalibration.setAttribute('aria-expanded', 'true');
  } else if (testMode === 'click_png') {
    applyPreset('Rahul Sharma', 'IIT2023045', 'B.Tech (Information Technology)');
    const url = (window.EMBEDDED_ASSETS && window.EMBEDDED_ASSETS.samplePortrait) || 'assets/sample-portrait.jpg';
    const img = new Image();
    img.onload = () => {
      state.photoImage = img;
      state.photoFileName = 'sample-portrait.jpg';
      renderCard();
      btnDownloadPNG.click();
    };
    img.src = url;
  } else if (testMode === 'click_pdf') {
    applyPreset('Rahul Sharma', 'IIT2023045', 'B.Tech (Information Technology)');
    const url = (window.EMBEDDED_ASSETS && window.EMBEDDED_ASSETS.samplePortrait) || 'assets/sample-portrait.jpg';
    const img = new Image();
    img.onload = () => {
      state.photoImage = img;
      state.photoFileName = 'sample-portrait.jpg';
      renderCard();
      btnDownloadPDF.click();
    };
    img.src = url;
  } else if (testMode === 'click_missing') {
    // Clear all fields and click download to test validation feedback
    studentNameInput.value = '';
    enrollmentInput.value = '';
    programInput.value = '';
    if (programSelect) programSelect.value = '';
    if (programOtherInput) programOtherInput.value = '';
    if (otherProgramContainer) otherProgramContainer.classList.add('hidden');
    state.studentName = '';
    state.enrollmentNo = '';
    state.program = '';
    state.photoImage = null;
    renderCard();
    btnDownloadPNG.click();
  } else {
    // Standard default: Clean blank form ready for user input
    renderCard();
  }
});

