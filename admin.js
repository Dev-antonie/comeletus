// ============================================
// SUPABASE SETUP
// Paste your real Project URL and anon key here, directly
// in this file — never back into chat or anywhere public.
// ============================================
const SUPABASE_URL = 'https://vmobswdwoxnnqcowynwi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtb2Jzd2R3b3hubnFjb3d5bndpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTYwMTAsImV4cCI6MjA5Nzk5MjAxMH0.dPij6QbLlcJb1KGJvIVQWSWD5QR1mPC0gbfiALnHjKc';

let supabaseClient;
if (typeof window.supabaseInstance === 'undefined') {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabaseInstance = supabaseClient;
} else {
  supabaseClient = window.supabaseInstance;
}

// ============================================
// ELEMENT REFERENCES
// ============================================
const loginView = document.getElementById('loginView');
const adminPanel = document.getElementById('adminPanel');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

const tabButtons = document.querySelectorAll('.tab-btn');
const listHeading = document.getElementById('listHeading');
const adminImageGrid = document.getElementById('adminImageGrid');

const fileInput = document.getElementById('fileInput');
const fileInputText = document.getElementById('fileInputText');
const altTextInput = document.getElementById('altTextInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadMessage = document.getElementById('uploadMessage');

// Tracks which bucket the admin is currently viewing —
// "gallery" or "flyers" — everything below reads/writes
// against whichever one is active right now.
let activeBucket = 'gallery';

// ============================================
// SESSION CHECK ON LOAD
// If a session already exists (the admin logged in earlier
// and didn't log out), skip straight to the panel instead
// of asking them to log in again every visit.
// ============================================
async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    showAdminPanel();
  } else {
    showLoginView();
  }
}

function showLoginView() {
  loginView.hidden = false;
  adminPanel.hidden = true;
}

function showAdminPanel() {
  loginView.hidden = true;
  adminPanel.hidden = false;
  loadImageList();
}

checkSession();

// ============================================
// LOGIN
// ============================================
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: loginEmail.value.trim(),
    password: loginPassword.value,
  });

  if (error) {
    loginError.textContent = 'Incorrect email or password. Please try again.';
    return;
  }

  loginForm.reset();
  showAdminPanel();
});

// ============================================
// LOGOUT
// ============================================
logoutBtn.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  showLoginView();
});

// ============================================
// TAB SWITCHING (Gallery / Flyers)
// ============================================
tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    tabButtons.forEach((btn) => btn.classList.remove('is-active'));
    button.classList.add('is-active');

    activeBucket = button.dataset.bucket;
    listHeading.textContent = activeBucket === 'gallery' ? 'Gallery Photos' : 'Campaign Flyers';

    resetUploadState();
    loadImageList();
  });
});

// ============================================
// LOAD AND RENDER THE CURRENT BUCKET'S IMAGES
// Each image gets its own delete button, wired up right
// here so the click handler always knows exactly which
// filename to remove.
// ============================================
async function loadImageList() {
  adminImageGrid.innerHTML = '<p class="admin-empty-message">Loading...</p>';

  const { data, error } = await supabaseClient.storage.from(activeBucket).list();

  if (error) {
    adminImageGrid.innerHTML = `<p class="admin-empty-message">Failed to load images: ${error.message}</p>`;
    return;
  }

  const files = data.filter((file) => file.name !== '.emptyFolderPlaceholder');

  if (files.length === 0) {
    adminImageGrid.innerHTML = '<p class="admin-empty-message">No images uploaded yet.</p>';
    return;
  }

  adminImageGrid.innerHTML = '';

  files.forEach((file) => {
    const { data: urlData } = supabaseClient.storage.from(activeBucket).getPublicUrl(file.name);

    const card = document.createElement('div');
    card.className = 'admin-image-card';

    const img = document.createElement('img');
    img.src = urlData.publicUrl;
    img.alt = file.metadata?.altText || file.name;
    card.appendChild(img);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'admin-delete-btn';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', `Delete ${file.name}`);
    deleteBtn.innerHTML = '<i class="ph ph-trash"></i>';

    deleteBtn.addEventListener('click', () => handleDelete(file.name));

    card.appendChild(deleteBtn);
    adminImageGrid.appendChild(card);
  });
}

// ============================================
// DELETE
// A plain confirm() popup before deleting — deletion is
// permanent, so this is a minimal but necessary safety net
// against an accidental click.
// ============================================
async function handleDelete(fileName) {
  const confirmed = window.confirm(`Delete this image? This cannot be undone.`);
  if (!confirmed) return;

  const { error } = await supabaseClient.storage.from(activeBucket).remove([fileName]);

  if (error) {
    alert(`Failed to delete: ${error.message}`);
    return;
  }

  loadImageList();
}

// ============================================
// UPLOAD
// The Upload button only enables once BOTH a file is
// selected AND a description has been typed — alt text is
// not optional here, since filenames alone (especially from
// AI image generators) are unreliable as accessible labels.
// ============================================
function updateUploadButtonState() {
  const hasFile = fileInput.files.length > 0;
  const hasAltText = altTextInput.value.trim().length > 0;
  uploadBtn.disabled = !(hasFile && hasAltText);
}

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    fileInputText.textContent = fileInput.files[0].name;
  } else {
    fileInputText.textContent = 'Choose an image to upload';
  }
  updateUploadButtonState();
});

altTextInput.addEventListener('input', updateUploadButtonState);

uploadBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  const altText = altTextInput.value.trim();
  if (!file || !altText) return;

  uploadBtn.disabled = true;
  uploadMessage.textContent = 'Uploading...';
  uploadMessage.className = 'upload-message';

  // Prefix with a timestamp so two uploads with the same
  // original filename (e.g. two photos both called
  // "flyer.jpg" taken on different days) never silently
  // overwrite each other.
  const uniqueName = `${Date.now()}-${file.name}`;

  // The typed description is stored as custom metadata on
  // the file itself, in Supabase Storage's "metadata" field —
  // not just kept in this form. script.js (the public site)
  // reads this back out via getPublicUrl()/list() and uses it
  // as the <img alt="..."> text, instead of guessing from the
  // filename.
  const { error } = await supabaseClient.storage.from(activeBucket).upload(uniqueName, file, {
    metadata: { altText },
  });

  if (error) {
    uploadMessage.textContent = `Upload failed: ${error.message}`;
    uploadMessage.className = 'upload-message is-error';
    uploadBtn.disabled = false;
    return;
  }

  uploadMessage.textContent = 'Uploaded successfully.';
  uploadMessage.className = 'upload-message is-success';
  resetUploadState();
  loadImageList();
});

function resetUploadState() {
  fileInput.value = '';
  altTextInput.value = '';
  fileInputText.textContent = 'Choose an image to upload';
  uploadBtn.disabled = true;
}