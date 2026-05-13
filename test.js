let progress = 0;
let startX = 0;
let active = 0;
let isDown = false;
let carouselActive = false;

const speedWheel = 0.02;
const speedDrag = -0.1;

const getZindex = (array, index) =>
  array.map((_, i) =>
    index === i ? array.length : array.length - Math.abs(index - i)
  );

const $items = document.querySelectorAll('.carousel-item');
const $carouselSection = document.querySelector('.weekly-geek-carousel');

const displayItems = (item, index, active) => {
  const zIndex = getZindex([...$items], active)[index];
  item.style.setProperty('--zIndex', zIndex);
  item.style.setProperty('--active', (index - active) / $items.length);
};

const animate = () => {
  progress = Math.max(0, Math.min(progress, 100));
  active = Math.floor((progress / 100) * ($items.length - 1));
  $items.forEach((item, index) => {
    displayItems(item, index, active);
    item.classList.toggle('is-active', index === active);
  });

  // Visual hint classes
  if ($carouselSection) {
    $carouselSection.classList.toggle('at-start', active === 0);
    $carouselSection.classList.toggle('at-end', active === $items.length - 1);
  }
};
animate();

// Click on card to jump to it
$items.forEach((item, i) => {
  item.addEventListener('click', () => {
    progress = (i / $items.length) * 100 + 10;
    animate();
  });
});

// Drag to navigate
const handleDragMove = (e) => {
  if (!isDown) return;
  const x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
  progress += (x - startX) * speedDrag;
  startX = x;
  animate();
};

if ($carouselSection) {
  $carouselSection.addEventListener('mousedown', (e) => {
    isDown = true;
    startX = e.clientX;
  });
  $carouselSection.addEventListener('mousemove', handleDragMove);
  $carouselSection.addEventListener('touchstart', (e) => {
    isDown = true;
    startX = e.touches[0].clientX;
  }, { passive: true });
  $carouselSection.addEventListener('touchmove', handleDragMove, { passive: true });
}

document.addEventListener('mouseup', () => { isDown = false; });
document.addEventListener('touchend', () => { isDown = false; });

// Scroll trap: intercept wheel globally (non-passive) when carousel is active
window.addEventListener('wheel', (e) => {
  if (!carouselActive) return;

  // Allow natural scroll inside speaker bio text
  if (e.target.closest('.speaker-bio')) return;

  const atStart = active === 0 && e.deltaY < 0;
  const atEnd = active === $items.length - 1 && e.deltaY > 0;

  if (atStart || atEnd) {
    carouselActive = false;
    return;
  }

  e.preventDefault();
  progress += e.deltaY * speedWheel;
  animate();
}, { passive: false });

// Activate carousel trap when section is sufficiently in view
if ($carouselSection) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const rect = entry.boundingClientRect;
        // Entering from below (scrolling down): start at first item
        // Entering from above (scrolling up): start at last item
        if (rect.top > 0) {
          progress = 0;
        } else {
          progress = 100;
        }
        animate();
        carouselActive = true;
      } else {
        carouselActive = false;
      }
    });
  }, { threshold: 0.55 });

  observer.observe($carouselSection);
}
