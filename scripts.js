document.addEventListener('DOMContentLoaded', () => {
  const logoObject = document.getElementById('logo-svg');
  const flowerBackgroundObject = document.getElementById('flower-background-object');
  const navSvgs = [
    document.getElementById('about-svg'),
    document.getElementById('blog-svg'),
    document.getElementById('projects-svg'),
  ].filter(Boolean);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const shuffleArray = (items) => {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };

  const animateFlowerBackground = () => {
    if (!flowerBackgroundObject) {
      return;
    }

    const svgDoc = flowerBackgroundObject.contentDocument;
    if (!svgDoc) {
      flowerBackgroundObject.classList.add('is-ready');
      return;
    }

    const flowers = Array.from(svgDoc.querySelectorAll('g[id^="flower-"]'));

    if (!flowers.length) {
      flowerBackgroundObject.classList.add('is-ready');
      return;
    }

    flowers.forEach((flower) => {
      flower.style.opacity = '0';
    });
    flowerBackgroundObject.classList.add('is-ready');

    if (prefersReducedMotion || typeof gsap === 'undefined') {
      flowers.forEach((flower) => {
        flower.style.opacity = '1';
      });
      return;
    }

    gsap.to(shuffleArray([...flowers]), {
      opacity: 1,
      duration: 0.8,
      stagger: 0.18,
      ease: 'power2.out',
    });
  };

  const showNavLinks = (immediate = false) => {
    if (!navSvgs.length) {
      return;
    }

    if (immediate || typeof gsap === 'undefined') {
      navSvgs.forEach((svg) => {
        svg.style.opacity = '1';
      });
      return;
    }

    gsap.fromTo(
      navSvgs,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 1.3,
        stagger: 0.4,
        ease: 'power2.out',
      }
    );
  };

  if (!logoObject) {
    showNavLinks(true);
    return;
  }

  const animateSvg = () => {
    const svgDoc = logoObject.contentDocument;
    if (!svgDoc) {
      showNavLinks(true);
      return;
    }

    const paths = Array.from(svgDoc.querySelectorAll('path'));
    if (!paths.length) {
      showNavLinks(true);
      return;
    }

    paths.forEach((path) => {
      const length = path.getTotalLength();
      const computed = svgDoc.defaultView.getComputedStyle(path);
      const fill = computed.fill || '#000';
      const fillOpacity = computed.fillOpacity || '1';

      path.dataset.originalFill = fill;
      path.dataset.originalFillOpacity = fillOpacity;

      path.style.stroke = fill;
      path.style.strokeWidth = '3';
      path.style.strokeLinecap = 'round';
      path.style.strokeLinejoin = 'round';
      path.style.fill = 'none';
      path.style.fillOpacity = '0';
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length);
    });

    if (prefersReducedMotion || typeof gsap === 'undefined') {
      paths.forEach((path) => {
        path.style.strokeDashoffset = '0';
        path.style.fill = path.dataset.originalFill || 'none';
        path.style.fillOpacity = path.dataset.originalFillOpacity || '1';
      });
      showNavLinks(true);
      return;
    }

    const dots = paths.filter((path) => path.classList.contains('dot') || /dot/i.test(path.id));
    const strokes = paths.filter((path) => !dots.includes(path));

    showNavLinks();
    const navLeadIn = navSvgs.length ? 0.5 * (navSvgs.length - 1) : 0;

    const tl = gsap.timeline({ defaults: { ease: 'power1.inOut' }, delay: navLeadIn });

    if (strokes.length) {
      tl.to(strokes, {
        strokeDashoffset: 0,
        duration: 1.8,
        stagger: 0.1,
      });

      tl.to(
        strokes,
        {
          duration: 1,
          fillOpacity: 1,
          onStart: () => {
            strokes.forEach((path) => {
              path.style.fill = path.dataset.originalFill || 'none';
            });
          },
        },
        '-=0.4'
      );
    }

    if (dots.length) {
      tl.to(
        dots,
        {
          strokeDashoffset: 0,
          duration: 0.8,
          stagger: 0.08,
        },
        '-=0.3'
      );

      tl.to(
        dots,
        {
          duration: 0.45,
          fillOpacity: 1,
          onStart: () => {
            dots.forEach((path) => {
              path.style.fill = path.dataset.originalFill || 'none';
            });
          },
        },
        '-=0.2'
      );
    }

  };

  if (logoObject.contentDocument) {
    animateSvg();
  } else {
    logoObject.addEventListener('load', animateSvg, { once: true });
  }

  if (flowerBackgroundObject) {
    if (flowerBackgroundObject.contentDocument) {
      animateFlowerBackground();
    } else {
      flowerBackgroundObject.addEventListener('load', animateFlowerBackground, { once: true });
    }
  }
});
