// ============================================
// SUPABASE SETUP
// Paste your real Project URL and anon key directly in
// this file on your machine — never back into chat.
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
// LIGHTBOX ELEMENT REFERENCES
// ============================================
const simpleLightboxOverlay = document.getElementById('simpleLightboxOverlay');
const simpleLightboxImage = document.getElementById('simpleLightboxImage');

const lightboxOverlay = document.getElementById('lightboxOverlay');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxCounter = document.getElementById('lightboxCounter');
const shareTriggerBtn = document.getElementById('shareTriggerBtn');
const shareDropdown = document.getElementById('shareDropdown');
const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');

// ============================================
// FETCH AND RENDER IMAGES FROM A BUCKET
// ============================================
async function loadImagesFromBucket(bucketName, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { data, error } = await supabaseClient.storage.from(bucketName).list();

  if (error) {
    console.error(`Failed to load images from ${bucketName}:`, error.message);
    return;
  }

  container.innerHTML = '';
  container.classList.remove('is-revealed');

  const visibleImageCount = 3;
  const validFiles = data.filter((file) => file.name !== '.emptyFolderPlaceholder');

  validFiles.forEach((file, index) => {
    const { data: urlData } = supabaseClient.storage.from(bucketName).getPublicUrl(file.name);

    const img = document.createElement('img');
    img.src = urlData.publicUrl;

    if (file.metadata?.altText) {
      img.alt = file.metadata.altText;
    } else {
      const cleanedName = file.name.split('.')[0].replace(/[-_]/g, ' ');
      const isGenericFilename = /^(img|dsc|photo|image)?\s*\d+$/i.test(cleanedName);
      img.alt = isGenericFilename ? 'Come Let Us community photo' : cleanedName;
    }

    img.loading = 'lazy';

    if (index >= visibleImageCount) {
      img.classList.add('extra-item');
    }

    container.appendChild(img);
  });

  initializeLoadMoreButton(containerId);

  if (containerId === 'galleryStrip') {
    attachGalleryLightbox(container);
  }

  if (containerId === 'flyerStrip') {
    attachFlyerLightbox(container);
  }
}

function initializePage() {
  document.documentElement.classList.add('js');
  initializeRevealObserver();

  loadImagesFromBucket('gallery', 'galleryStrip');
  loadImagesFromBucket('flyers', 'flyerStrip');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePage);
} else {
  initializePage();
}

// ============================================
// HAMBURGER MENU TOGGLE
// ============================================
const navToggle = document.getElementById('navToggle');
const mobileNav = document.getElementById('mobileNav');

navToggle.addEventListener('click', () => {
  const isOpen = navToggle.classList.toggle('is-open');
  mobileNav.classList.toggle('is-open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

mobileNav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navToggle.classList.remove('is-open');
    mobileNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// ============================================
// SCROLL REVEAL OBSERVER
// ============================================
function initializeRevealObserver() {
  const revealElements = document.querySelectorAll('.reveal-on-scroll');

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      root: null,
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    },
  );

  revealElements.forEach((element) => {
    revealObserver.observe(element);
  });
}

// ============================================
// SCROLL-TO-TOP BUTTON VISIBILITY
// ============================================
const scrollTopLink = document.getElementById('scrollTopLink');

window.addEventListener('scroll', () => {
  if (window.scrollY > 400) {
    scrollTopLink.classList.add('is-visible');
  } else {
    scrollTopLink.classList.remove('is-visible');
  }
});

// ============================================
// GALLERY ARROWS (desktop scroll handler)
// ============================================
document.querySelectorAll('.gallery-arrow').forEach((button) => {
  button.addEventListener('click', () => {
    const strip = document.getElementById(button.dataset.target);
    if (!strip) return;

    const scrollAmount = strip.clientWidth * 0.8;
    const direction = button.classList.contains('next') ? 1 : -1;
    strip.scrollBy({ left: scrollAmount * direction, behavior: 'smooth' });
  });
});

// ============================================
// LOAD MORE INITIALIZER
// ============================================
function initializeLoadMoreButton(containerId) {
  const button = document.querySelector(`.load-more-btn[data-target="${containerId}"]`);
  const strip = document.getElementById(containerId);
  if (!button || !strip) return;

  const hasExtraImages = strip.querySelectorAll('.extra-item').length > 0;
  if (!hasExtraImages) {
    button.classList.add('is-hidden');
    return;
  }

  button.classList.remove('is-hidden');

  const newButton = button.cloneNode(true);
  button.parentNode.replaceChild(newButton, button);

  newButton.addEventListener('click', () => {
    strip.classList.add('is-revealed');
    newButton.classList.add('is-hidden');
  });
}

// ============================================
// LIGHTBOX PLAYBACK/MANAGEMENT
// ============================================
function attachGalleryLightbox(container) {
  const galleryImages = container.querySelectorAll('img');
  galleryImages.forEach((img) => {
    img.addEventListener('click', (event) => {
      event.stopPropagation();
      simpleLightboxImage.src = img.src;
      simpleLightboxImage.alt = img.alt;
      simpleLightboxOverlay.classList.add('is-open');
    });
  });
}

function attachFlyerLightbox(container) {
  const flyerImages = Array.from(container.querySelectorAll('img'));
  flyerImages.forEach((img, index) => {
    img.addEventListener('click', (event) => {
      event.stopPropagation();

      lightboxImage.src = img.src;
      lightboxImage.alt = img.alt;
      lightboxTitle.textContent = img.alt || 'Come Let Us Campaign';
      lightboxCounter.textContent = `${index + 1} / ${flyerImages.length}`;

      lightboxOverlay.classList.add('is-open');
    });
  });
}

// ============================================
// CONTACT FORM
// Submits to Formspree via fetch() instead of a normal page
// reload, so the person sees a success/error message right
// on the page rather than being navigated away.
// ============================================
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitButton = contactForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';

    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        body: new FormData(contactForm),
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        alert("Thanks for reaching out — we've received your message and will get back to you soon.");
        contactForm.reset();
      } else {
        alert('Something went wrong sending your message. Please try again, or email us directly.');
      }
    } catch (error) {
      alert('Something went wrong sending your message. Please check your connection and try again.');
    }

    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
  });
}

// ============================================
// SIMPLE LIGHTBOX CLOSING LOGIC
// ============================================
function closeSimpleLightbox() {
  simpleLightboxOverlay.classList.remove('is-open');
}

if (simpleLightboxOverlay && simpleLightboxImage) {
  simpleLightboxOverlay.addEventListener('click', closeSimpleLightbox);
  simpleLightboxImage.addEventListener('click', closeSimpleLightbox);
}

// ============================================
// ENHANCED LIGHTBOX CLOSING LOGIC
// ============================================
function closeLightbox() {
  lightboxOverlay.classList.remove('is-open');
  shareDropdown.classList.remove('is-active');
}

if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);

if (lightboxOverlay) {
  lightboxOverlay.addEventListener('click', (event) => {
    if (event.target === lightboxOverlay) {
      closeLightbox();
    }
  });
}

if (shareTriggerBtn) {
  shareTriggerBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    shareDropdown.classList.toggle('is-active');
  });
}

document.addEventListener('click', () => {
  if (shareDropdown) shareDropdown.classList.remove('is-active');
});