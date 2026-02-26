document.addEventListener('DOMContentLoaded', () => {
  const logoObject = document.getElementById('logo-svg');
  const linkedPageLogoObject = document.getElementById('logo-svg-linked-page');
  const flowerBackgroundObject = document.getElementById('flower-background-object');
  const navLinksContainer = document.querySelector('.nav-links');
  const navSvgs = [
    document.getElementById('about-svg'),
    document.getElementById('blog-svg'),
    document.getElementById('projects-svg'),
  ].filter(Boolean);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PAGE_TRANSITION_STORAGE_KEY = 'navLogoPageTransition';
  const LINK_PAGE_LOGO_TARGET_TOP = 30;
  const LINK_PAGE_LOGO_TARGET_HEIGHT = 80;

  const clearStoredPageTransition = () => {
    try {
      sessionStorage.removeItem(PAGE_TRANSITION_STORAGE_KEY);
    } catch (_) {
      // Ignore storage failures and continue without the transition.
    }
  };

  const storePageTransition = (payload) => {
    try {
      sessionStorage.setItem(PAGE_TRANSITION_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
      // Ignore storage failures and continue without the transition.
    }
  };

  const readStoredPageTransition = () => {
    try {
      const raw = sessionStorage.getItem(PAGE_TRANSITION_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        clearStoredPageTransition();
        return null;
      }

      return parsed;
    } catch (_) {
      clearStoredPageTransition();
      return null;
    }
  };

  const getPathname = (href) => {
    try {
      return new URL(href, window.location.href).pathname;
    } catch (_) {
      return null;
    }
  };

  const getLinkedPageLogoTargetRectFromSourceLogo = (logoRect) => {
    const sourceHeight = logoRect.height || 150;
    const scale = LINK_PAGE_LOGO_TARGET_HEIGHT / sourceHeight;
    const width = logoRect.width * scale;
    const height = logoRect.height * scale;

    return {
      left: (window.innerWidth - width) / 2,
      top: LINK_PAGE_LOGO_TARGET_TOP,
      width,
      height,
      scale,
    };
  };

  const hasRectSize = (rect) => Boolean(rect && rect.width && rect.height);
  const hasGsap = () => typeof gsap !== 'undefined';
  const canAnimateWithGsap = () => !prefersReducedMotion && hasGsap();

  const setElementOpacity = (elements, opacity) => {
    elements.forEach((element) => {
      element.style.opacity = opacity;
    });
  };

  const runNowOrOnObjectLoad = (objectEl, callback) => {
    if (!objectEl) {
      return;
    }

    if (objectEl.contentDocument) {
      callback();
      return;
    }

    objectEl.addEventListener('load', callback, { once: true });
  };

  const isPlainLeftClick = (event) => (
    !event.defaultPrevented
    && event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
  );

  const animateLinkedPageLogoArrival = () => {
    if (!linkedPageLogoObject || prefersReducedMotion) {
      clearStoredPageTransition();
      return;
    }

    const transition = readStoredPageTransition();
    if (!transition) {
      return;
    }

    const now = Date.now();
    const maxAgeMs = 10000;
    if (!transition.timestamp || now - transition.timestamp > maxAgeMs) {
      clearStoredPageTransition();
      return;
    }

    if (transition.destinationPath !== window.location.pathname) {
      clearStoredPageTransition();
      return;
    }

    const startRect = transition.endRect || transition.startRect;
    if (!hasRectSize(startRect)) {
      clearStoredPageTransition();
      return;
    }

    const destinationRect = linkedPageLogoObject.getBoundingClientRect();
    if (!hasRectSize(destinationRect)) {
      clearStoredPageTransition();
      return;
    }

    linkedPageLogoObject.style.visibility = 'hidden';

    const overlayLogo = document.createElement('img');
    overlayLogo.src = 'svgs/1-cropped.svg';
    overlayLogo.alt = '';
    overlayLogo.setAttribute('aria-hidden', 'true');
    overlayLogo.style.position = 'fixed';
    overlayLogo.style.left = `${startRect.left}px`;
    overlayLogo.style.top = `${startRect.top}px`;
    overlayLogo.style.width = `${startRect.width}px`;
    overlayLogo.style.height = `${startRect.height}px`;
    overlayLogo.style.pointerEvents = 'none';
    overlayLogo.style.zIndex = '9999';
    overlayLogo.style.transformOrigin = 'center center';
    overlayLogo.style.willChange = 'left, top, width, height, opacity';
    document.body.appendChild(overlayLogo);

    const cleanup = () => {
      linkedPageLogoObject.style.visibility = '';
      overlayLogo.remove();
      clearStoredPageTransition();
    };

    const duration = 1000;
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

    if (typeof overlayLogo.animate !== 'function') {
      cleanup();
      return;
    }

    const animation = overlayLogo.animate(
      [
        {
          left: `${startRect.left}px`,
          top: `${startRect.top}px`,
          width: `${startRect.width}px`,
          height: `${startRect.height}px`,
          opacity: 1,
        },
        {
          left: `${destinationRect.left}px`,
          top: `${destinationRect.top}px`,
          width: `${destinationRect.width}px`,
          height: `${destinationRect.height}px`,
          opacity: 1,
        },
      ],
      {
        duration,
        easing,
        fill: 'forwards',
      }
    );

    animation.addEventListener('finish', cleanup, { once: true });
    animation.addEventListener('cancel', cleanup, { once: true });
  };

  const setupIndexNavPageTransition = () => {
    if (!logoObject || !navLinksContainer || prefersReducedMotion) {
      return;
    }

    const navLinks = Array.from(navLinksContainer.querySelectorAll('a[href]'));
    if (!navLinks.length) {
      return;
    }

    let isTransitioning = false;

    navLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        if (isTransitioning) {
          event.preventDefault();
          return;
        }

        if (!isPlainLeftClick(event)) {
          return;
        }

        const href = link.getAttribute('href');
        const destinationPath = getPathname(href);
        if (!href || !destinationPath) {
          return;
        }

        event.preventDefault();
        isTransitioning = true;

        const logoRect = logoObject.getBoundingClientRect();
        const currentCenterX = logoRect.left + (logoRect.width / 2);
        const currentCenterY = logoRect.top + (logoRect.height / 2);
        const targetRect = getLinkedPageLogoTargetRectFromSourceLogo(logoRect);
        const scale = targetRect.scale;
        const endWidth = targetRect.width;
        const endHeight = targetRect.height;
        const endLeft = targetRect.left;
        const endTop = targetRect.top;
        const targetCenterX = endLeft + (endWidth / 2);
        const targetCenterY = endTop + (endHeight / 2);
        const translateX = targetCenterX - currentCenterX;
        const translateY = targetCenterY - currentCenterY;

        storePageTransition({
          destinationPath,
          timestamp: Date.now(),
          startRect: {
            left: logoRect.left,
            top: logoRect.top,
            width: logoRect.width,
            height: logoRect.height,
          },
          endRect: {
            left: endLeft,
            top: endTop,
            width: endWidth,
            height: endHeight,
          },
        });

        logoObject.style.transformOrigin = 'center center';
        logoObject.style.willChange = 'transform, opacity';
        navLinksContainer.style.pointerEvents = 'none';
        document.body.classList.add('is-page-transitioning');

        const navigate = () => {
          window.location.href = href;
        };

        if (hasGsap()) {
          gsap.killTweensOf(logoObject);
          gsap.killTweensOf(navLinksContainer);

          const tl = gsap.timeline({ onComplete: navigate });
          tl.to(
            navLinksContainer,
            {
              opacity: 0,
              duration: 1.15,
              ease: 'power2.out',
            },
            0
          );
          tl.to(
            logoObject,
            {
              x: translateX,
              y: translateY,
              scale,
              duration: 1.2,
              ease: 'power2.inOut',
            },
            0
          );
          return;
        }

        if (typeof logoObject.animate === 'function' && typeof navLinksContainer.animate === 'function') {
          navLinksContainer.animate(
            [
              { opacity: 1 },
              { opacity: 0 },
            ],
            {
              duration: 1150,
              easing: 'ease-out',
              fill: 'forwards',
            }
          );

          const anim = logoObject.animate(
            [
              { transform: 'translate3d(0, 0, 0) scale(1)' },
              { transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})` },
            ],
            {
              duration: 1200,
              easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
              fill: 'forwards',
            }
          );

          anim.addEventListener('finish', navigate, { once: true });
          anim.addEventListener('cancel', navigate, { once: true });
          return;
        }

        navigate();
      });
    });
  };

  const initPageTransitions = () => {
    animateLinkedPageLogoArrival();
    setupIndexNavPageTransition();
  };

  // Hovering over the navigation links changes the fill color of the SVGs to a bright pink. 

  const setupNavLinkHoverEffects = () => {
    const navLinkObjects = document.querySelectorAll('.nav-links a object');

    navLinkObjects.forEach((obj) => {
      const link = obj.closest('a');
      if (!link) {
        return;
      }

      const paint = (color = '') => {
        const doc = obj.contentDocument;
        if (!doc) {
          return;
        }

        doc.querySelectorAll('[fill]').forEach((el) => {
          if (el.getAttribute('fill') !== 'none') {
            el.style.fill = color;
          }
        });
      };

      const bind = () => {
        link.addEventListener('mouseenter', () => paint('#f2778e'));
        link.addEventListener('mouseleave', () => paint(''));
      };

      runNowOrOnObjectLoad(obj, bind);
    });
  };

  const initNavInteractions = () => {
    setupNavLinkHoverEffects();
  };


  // Utility functions for working with the SVG structure.

  const shuffleArray = (items) => {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };

  const findCommentNode = (root, matcher) => {
    const stack = Array.from(root.childNodes || []).reverse();

    while (stack.length) {
      const node = stack.pop();

      if (node.nodeType === Node.COMMENT_NODE) {
        const text = (node.nodeValue || '').trim();
        if (matcher.test(text)) {
          return node;
        }
      }

      if (node.childNodes && node.childNodes.length) {
        for (let i = node.childNodes.length - 1; i >= 0; i -= 1) {
          stack.push(node.childNodes[i]);
        }
      }
    }

    return null;
  };

  const getFollowingSiblingGroups = (commentNode) => {
    if (!commentNode) {
      return [];
    }

    const groups = [];
    let sibling = commentNode.nextSibling;

    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName?.toLowerCase() === 'g') {
        groups.push(sibling);
      }
      sibling = sibling.nextSibling;
    }

    return groups;
  };

  const getFlowerCenterGroup = (flower) => {
    const centerComment = findCommentNode(flower, /\bcenter\b/i);
    const groups = getFollowingSiblingGroups(centerComment);

    if (groups.length) {
      return groups[0];
    }

    return flower.firstElementChild;
  };

  const getFlowerPetalGroups = (flowers) => flowers.flatMap((flower) => {
    const petalsComment = findCommentNode(flower, /\bpetals\b/i);
    const petalGroups = getFollowingSiblingGroups(petalsComment);

    if (petalGroups.length) {
      return petalGroups;
    }

    // Fallback for unexpected SVG structure.
    const childGroups = Array.from(flower.children);
    if (!childGroups.length) {
      return [];
    }

    return flower.id === 'flower-15' ? childGroups : childGroups.slice(1);
  });

  const bindFlowerCenterClick = (centerGroup, boundDatasetKey, onClick) => {
    if (!centerGroup || centerGroup.dataset[boundDatasetKey] === 'true') {
      return false;
    }

    centerGroup.dataset[boundDatasetKey] = 'true';

    document.addEventListener('click', (event) => {
      const rect = centerGroup.getBoundingClientRect();

      if (!rect.width || !rect.height) {
        return;
      }

      // Slightly larger hit area so the easter egg is discoverable without pixel-perfect clicks.
      const hitPadding = 8;
      const withinX = event.clientX >= rect.left - hitPadding && event.clientX <= rect.right + hitPadding;
      const withinY = event.clientY >= rect.top - hitPadding && event.clientY <= rect.bottom + hitPadding;

      if (!withinX || !withinY) {
        return;
      }

      onClick(event);
    });

    return true;
  };

  // The "flower color shift" easter egg toggles the colors of the flowers to a soft pink when the center of flower 8 is clicked.

  const setupFlowerColorShiftEasterEgg = (svgDoc, flowers) => {
    const flower8 = svgDoc.getElementById('flower-8');
    const flower8Center = flower8 ? getFlowerCenterGroup(flower8) : null;

    if (!flower8Center) {
      return;
    }

    const flowerPaths = flowers.flatMap((flower) => Array.from(flower.querySelectorAll('path')));
    const colorPaths = flowerPaths.filter((path) => {
      const fill = (path.getAttribute('fill') || '').trim().toLowerCase();
      return fill && fill !== 'none';
    });

    if (!colorPaths.length) {
      return;
    }

    colorPaths.forEach((path) => {
      if (!path.dataset.originalFlowerFill) {
        const originalFill = path.getAttribute('fill') || svgDoc.defaultView?.getComputedStyle(path).fill;
        if (originalFill) {
          path.dataset.originalFlowerFill = originalFill;
        }
      }
    });

    const pinkShiftFill = '#f6dbe0'; // A soft pink that contrasts well with the original colors
    let isPinkShiftActive = false;
    let isAnimating = false;

    const toggleFlowerColors = () => {
      if (isAnimating) {
        return;
      }

      const nextPinkShiftState = !isPinkShiftActive;

      if (prefersReducedMotion || typeof gsap === 'undefined') {
        colorPaths.forEach((path) => {
          if (nextPinkShiftState) {
            path.style.fill = pinkShiftFill;
            return;
          }

          path.style.fill = '';
        });

        isPinkShiftActive = nextPinkShiftState;
        return;
      }

      isAnimating = true;
      gsap.killTweensOf(colorPaths);

      gsap.to(colorPaths, {
        fill: (_, path) => (nextPinkShiftState ? pinkShiftFill : (path.dataset.originalFlowerFill || path.getAttribute('fill') || 'none')),
        duration: 0.7,
        ease: 'power2.inOut',
        stagger: {
          each: 0.003,
          from: 'random',
        },
        onComplete: () => {
          isPinkShiftActive = nextPinkShiftState;
          isAnimating = false;

          if (!isPinkShiftActive) {
            colorPaths.forEach((path) => {
              path.style.fill = '';
            });
          }
        },
      });
    };

    bindFlowerCenterClick(flower8Center, 'colorShiftEasterEggBound', toggleFlowerColors);
  };

  // The "flower petal fall" easter egg animates the petals of all the flowers to fall off when the center of flower 10 is clicked.

  const setupFlowerPetalEasterEgg = (svgDoc, flowers) => {
    const flower10 = svgDoc.getElementById('flower-10');
    const flower10Center = flower10 ? getFlowerCenterGroup(flower10) : null;

    if (!flower10Center) {
      return;
    }

    const petalGroups = getFlowerPetalGroups(flowers);
    if (!petalGroups.length) {
      return;
    }

    let isAnimating = false;
    const triggerPetalFall = () => {
      if (isAnimating) {
        return;
      }

      isAnimating = true;

      if (!canAnimateWithGsap()) {
        setElementOpacity(petalGroups, '0');

        window.setTimeout(() => {
          setElementOpacity(petalGroups, '1');
          isAnimating = false;
        }, 2000);

        return;
      }

      gsap.killTweensOf(petalGroups);

      const fallDistances = new Map(
        petalGroups.map((petal) => {
          const rect = petal.getBoundingClientRect();
          const distance = Math.max(window.innerHeight - rect.top + rect.height + 48, 120);
          return [petal, distance];
        })
      );

      const tl = gsap.timeline({
        onComplete: () => {
          isAnimating = false;
        },
      });

      tl.to(petalGroups, {
        y: (_, petal) => fallDistances.get(petal) || window.innerHeight,
        rotation: () => gsap.utils.random(-35, 35),
        opacity: 0,
        duration: 0.85,
        stagger: {
          each: 0.015,
          from: 'random',
        },
        ease: 'power2.in',
      });

      tl.set(petalGroups, {
        y: 0,
        rotation: 0,
        opacity: 0,
      }, '+=2');

      tl.to(petalGroups, {
        opacity: 1,
        duration: 0.6,
        stagger: 0.01,
        ease: 'power2.out',
        clearProps: 'opacity,transform',
      });
    };

    bindFlowerCenterClick(flower10Center, 'petalEasterEggBound', triggerPetalFall);
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

    setupFlowerColorShiftEasterEgg(svgDoc, flowers);
    setupFlowerPetalEasterEgg(svgDoc, flowers);

    setElementOpacity(flowers, '0');
    flowerBackgroundObject.classList.add('is-ready');

    if (!canAnimateWithGsap()) {
      setElementOpacity(flowers, '1');
      return;
    }

    gsap.to(shuffleArray([...flowers]), {
      opacity: 1,
      duration: 0.8,
      stagger: 0.18,
      ease: 'power2.out',
    });
  };

  // Shows the navigation link SVGs with a fade-in animation

  const showNavLinks = (immediate = false) => {
    if (!navSvgs.length) {
      return;
    }

    if (immediate || !hasGsap()) {
      setElementOpacity(navSvgs, '1');
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

  const initializeLogoPathsForDrawAnimation = (svgDoc, paths) => {
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
  };

  const finishLogoPathsImmediately = (paths) => {
    paths.forEach((path) => {
      path.style.strokeDashoffset = '0';
      path.style.fill = path.dataset.originalFill || 'none';
      path.style.fillOpacity = path.dataset.originalFillOpacity || '1';
    });
  };

  const restorePathFills = (paths) => {
    paths.forEach((path) => {
      path.style.fill = path.dataset.originalFill || 'none';
    });
  };

  const animateLogoSvg = () => {
    if (!logoObject) {
      showNavLinks(true);
      return;
    }

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

    initializeLogoPathsForDrawAnimation(svgDoc, paths);

    if (!canAnimateWithGsap()) {
      finishLogoPathsImmediately(paths);
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
          onStart: () => restorePathFills(strokes),
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
          onStart: () => restorePathFills(dots),
        },
        '-=0.2'
      );
    }
  };

  const initLogoAnimation = () => {
    if (!logoObject) {
      showNavLinks(true);
      return;
    }

    runNowOrOnObjectLoad(logoObject, animateLogoSvg);
  };

  const initFlowerBackground = () => {
    runNowOrOnObjectLoad(flowerBackgroundObject, animateFlowerBackground);
  };

  const initializePage = () => {
    initPageTransitions();
    initNavInteractions();
    initLogoAnimation();
    initFlowerBackground();
  };

  initializePage();
});
