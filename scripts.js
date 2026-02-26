document.addEventListener('DOMContentLoaded', () => {
  const logoObject = document.getElementById('logo-svg');
  const linkedPageLogoObject = document.getElementById('logo-svg-linked-page');
  const linkedPageLogoLink = document.querySelector('.linked-page-logo-link[href]');
  const flowerBackgroundObject = document.getElementById('flower-background-object');
  const navLinksContainer = document.querySelector('.nav-links');
  const navSvgs = [
    document.getElementById('about-svg'),
    document.getElementById('blog-svg'),
    document.getElementById('projects-svg'),
  ].filter(Boolean);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PAGE_TRANSITION_STORAGE_KEY = 'navLogoPageTransition';
  const DEFAULT_PAGE_TRANSITION_MAX_AGE_MS = 10000;
  const INDEX_RETURN_FALLBACK_MAX_AGE_MS = 5000;
  const LINK_PAGE_LOGO_TARGET_TOP = 30;
  const LINK_PAGE_LOGO_TARGET_HEIGHT = 80;
  let skipIndexLogoIntroAnimation = false;
  let isIndexReturnAnimating = false;

  // Utility functions for managing page transition state in sessionStorage, and performing the index return animation.

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

  // Extracts the pathname from a URL, resolving relative URLs against the current location. Returns null for invalid URLs.

  const getPathname = (href) => {
    try {
      return new URL(href, window.location.href).pathname;
    } catch (_) {
      return null;
    }
  };

  const normalizePathname = (pathname) => {
    if (typeof pathname !== 'string' || !pathname) {
      return pathname;
    }

    if (pathname === '/index.html') {
      return '/';
    }

    if (pathname.endsWith('/index.html')) {
      return pathname.slice(0, -'index.html'.length) || '/';
    }

    return pathname;
  };

  const pathnamesMatch = (a, b) => normalizePathname(a) === normalizePathname(b);

  // Elements position and size.
  
  const getRectSnapshot = (rect) => ({
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  });

  // Calculates the translation and scale needed to transform one rect to another, based on their center points.

  const getTransformBetweenRects = (fromRect, toRect) => {
    const fromCenterX = fromRect.left + (fromRect.width / 2);
    const fromCenterY = fromRect.top + (fromRect.height / 2);
    const toCenterX = toRect.left + (toRect.width / 2);
    const toCenterY = toRect.top + (toRect.height / 2);

    return {
      x: toCenterX - fromCenterX,
      y: toCenterY - fromCenterY,
      scale: (toRect.height || 1) / (fromRect.height || 1),
    };
  };

  // Makes sure the stored transition data is not too old and matches the current page.

  const getStoredTransitionMaxAgeMs = (transition) => {
    const maxAgeMs = Number(transition?.maxAgeMs);
    if (Number.isFinite(maxAgeMs) && maxAgeMs > 0) {
      return maxAgeMs;
    }

    return DEFAULT_PAGE_TRANSITION_MAX_AGE_MS;
  };

  // Calculates where the logog should animate to.

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

  // Checks for necessary conditions before running animations.

  const hasRectSize = (rect) => Boolean(rect && rect.width && rect.height);
  const hasGsap = () => typeof gsap !== 'undefined';
  const canAnimateWithGsap = () => !prefersReducedMotion && hasGsap();

  // Shows the navigation links by setting their opacity.

  const setElementOpacity = (elements, opacity) => {
    elements.forEach((element) => {
      element.style.opacity = opacity;
    });
  };

  // Determines when object elements should load.

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

  // Only handle normal left-clicks.

  const isPlainLeftClick = (event) => (
    !event.defaultPrevented
    && event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
  );

  // Reads the stored page transition data and validates it against the current page and timestamp.

  const readStoredTransitionForCurrentPage = () => {
    const transition = readStoredPageTransition();
    if (!transition) {
      return null;
    }

    if (!transition.timestamp || Date.now() - transition.timestamp > getStoredTransitionMaxAgeMs(transition)) {
      clearStoredPageTransition();
      return null;
    }

    if (!pathnamesMatch(transition.destinationPath, window.location.pathname)) {
      clearStoredPageTransition();
      return null;
    }

    return transition;
  };

  // Saves the page transition data, including the destination path and the starting and ending rectangles for the animation.

  const savePageTransitionRects = ({
    destinationPath,
    startRect,
    endRect = null,
    maxAgeMs = DEFAULT_PAGE_TRANSITION_MAX_AGE_MS,
  }) => {
    if (!destinationPath || !hasRectSize(startRect)) {
      return false;
    }

    const payload = {
      destinationPath,
      timestamp: Date.now(),
      maxAgeMs,
      startRect: getRectSnapshot(startRect),
    };

    if (hasRectSize(endRect)) {
      payload.endRect = getRectSnapshot(endRect);
    }

    storePageTransition(payload);
    return true;
  };

  // Prepares the navigation links for the fade-in animation.

  const prepareIndexNavLinksForFadeIn = () => {
    if (!navLinksContainer) {
      return;
    }

    navLinksContainer.style.opacity = '1';
    navLinksContainer.style.pointerEvents = 'none';
    setElementOpacity(navSvgs, '0');
  };

  // Resets the styles applied during the index return animation.

  const cleanupIndexReturnAnimationState = () => {
    if (logoObject) {
      logoObject.style.transform = '';
      logoObject.style.willChange = '';
    }

    if (navLinksContainer) {
      navLinksContainer.style.opacity = '';
      navLinksContainer.style.pointerEvents = '';
    }

    document.body.classList.remove('is-page-transitioning');
    isIndexReturnAnimating = false;
  };

  // Runs the index return animation.

  const runIndexReturnAnimation = () => {
    if (!logoObject || !navLinksContainer || isIndexReturnAnimating) {
      return false;
    }

    isIndexReturnAnimating = true;
    logoObject.style.transformOrigin = 'center center';
    logoObject.style.willChange = 'transform';
    prepareIndexNavLinksForFadeIn();
    document.body.classList.remove('is-page-transitioning');

    if (hasGsap()) {
      gsap.killTweensOf(logoObject);
      gsap.killTweensOf(navLinksContainer);
      gsap.killTweensOf(navSvgs);

      showNavLinks();

      gsap.to(logoObject, {
        x: 0,
        y: 0,
        scale: 1,
        duration: 1.2,
        ease: 'power2.inOut',
        onComplete: cleanupIndexReturnAnimationState,
        onInterrupt: cleanupIndexReturnAnimationState,
      });

      return true;
    }

    showNavLinks();

    if (typeof logoObject.animate === 'function') {
      const currentTransform = window.getComputedStyle(logoObject).transform;
      const animation = logoObject.animate(
        [
          { transform: currentTransform === 'none' ? 'translate3d(0, 0, 0) scale(1)' : currentTransform },
          { transform: 'translate3d(0, 0, 0) scale(1)' },
        ],
        {
          duration: 1200,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'forwards',
        }
      );

      animation.addEventListener('finish', cleanupIndexReturnAnimationState, { once: true });
      animation.addEventListener('cancel', cleanupIndexReturnAnimationState, { once: true });
      return true;
    }

    cleanupIndexReturnAnimationState();
    return true;
  };

  // Skips the index return animation and shows the navigation links immediately.

  const enterIndexReturnMode = () => {
    skipIndexLogoIntroAnimation = true;
    clearStoredPageTransition();
  };

  // Starts the index return animation from the given starting rectangle.

  const startIndexReturnAnimationFromRect = (startRect) => {
    if (!logoObject || !hasRectSize(startRect)) {
      clearStoredPageTransition();
      return;
    }

    runNowOrOnObjectLoad(logoObject, () => {
      const homeRect = logoObject.getBoundingClientRect();
      if (!hasRectSize(homeRect)) {
        clearStoredPageTransition();
        return;
      }

      const { x, y, scale } = getTransformBetweenRects(homeRect, startRect);
      enterIndexReturnMode();

      logoObject.style.transformOrigin = 'center center';
      logoObject.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;

      runIndexReturnAnimation();
    });
  };

  const restoreIndexReturnFromStoredTransition = () => {
    if (!logoObject || !navLinksContainer) {
      return;
    }

    const transition = readStoredTransitionForCurrentPage();
    if (!transition) {
      return;
    }

    if (prefersReducedMotion) {
      clearStoredPageTransition();
      return;
    }

    startIndexReturnAnimationFromRect(transition.startRect || transition.endRect);
  };

  // Checks if the home page is mid transition.

  const hasIndexExitVisualState = () => {
    if (!logoObject || !navLinksContainer) {
      return false;
    }

    const navOpacity = window.getComputedStyle(navLinksContainer).opacity;
    const logoTransform = window.getComputedStyle(logoObject).transform;

    return (
      document.body.classList.contains('is-page-transitioning')
      || navLinksContainer.style.pointerEvents === 'none'
      || navOpacity === '0'
      || logoTransform !== 'none'
    );
  };

  // Enters the index return mode, preparing for the animation.

  const setupIndexReturnTransition = () => {
    if (!logoObject || !navLinksContainer) {
      return;
    }

    restoreIndexReturnFromStoredTransition();

    if (prefersReducedMotion) {
      return;
    }

    window.addEventListener('pageshow', (event) => {
      if (!event.persisted || !hasIndexExitVisualState()) {
        return;
      }

      enterIndexReturnMode();
      runIndexReturnAnimation();
    });
  };

  // Sets up the page transition for returning to the home page from a linked page.

  const setupLinkedPageHomeReturnTransition = () => {
    if (!linkedPageLogoObject || !linkedPageLogoLink || prefersReducedMotion) {
      return;
    }

    const storeHomeReturnTransition = (maxAgeMs = DEFAULT_PAGE_TRANSITION_MAX_AGE_MS) => {
      const destinationPath = getPathname(linkedPageLogoLink.getAttribute('href'));
      savePageTransitionRects({
        destinationPath,
        startRect: linkedPageLogoObject.getBoundingClientRect(),
        maxAgeMs,
      });
    };

    let didStoreExplicitHomeClickTransition = false;

    linkedPageLogoLink.addEventListener('click', (event) => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.detail !== 0 && !isPlainLeftClick(event)) {
        return;
      }

      didStoreExplicitHomeClickTransition = true;
      storeHomeReturnTransition();
    });

    window.addEventListener('pagehide', () => {
      if (didStoreExplicitHomeClickTransition) {
        return;
      }

      storeHomeReturnTransition(INDEX_RETURN_FALLBACK_MAX_AGE_MS);
    });

    window.addEventListener('pageshow', () => {
      didStoreExplicitHomeClickTransition = false;
    });
  };

  const animateLinkedPageLogoArrival = () => {
    if (!linkedPageLogoObject) {
      return;
    }

    if (prefersReducedMotion) {
      clearStoredPageTransition();
      return;
    }

    const transition = readStoredTransitionForCurrentPage();
    if (!transition) {
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

  // Sets up the page transition for navigating from the home page to a linked page.

  const setupIndexNavPageTransition = () => {
    if (!logoObject || !navLinksContainer || prefersReducedMotion) {
      return;
    }

    const navLinks = Array.from(navLinksContainer.querySelectorAll('a[href]'));
    if (!navLinks.length) {
      return;
    }

    let isTransitioning = false;

    window.addEventListener('pageshow', (event) => {
      if (!event.persisted) {
        return;
      }

      isTransitioning = false;
      navLinksContainer.style.pointerEvents = '';
      document.body.classList.remove('is-page-transitioning');
    });

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
        const targetRect = getLinkedPageLogoTargetRectFromSourceLogo(logoRect);
        const { x: translateX, y: translateY, scale } = getTransformBetweenRects(logoRect, targetRect);

        savePageTransitionRects({
          destinationPath,
          startRect: logoRect,
          endRect: targetRect,
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

  // Runs the initial page transition animations.

  const initPageTransitions = () => {
    setupIndexReturnTransition();
    animateLinkedPageLogoArrival();
    setupLinkedPageHomeReturnTransition();
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

  // Animates the flower background on the homepage with a staggered fade-in effect, and sets up the easter eggs.

  const getFlowerBackgroundContext = () => {
    if (!flowerBackgroundObject) {
      return null;
    }

    const svgDoc = flowerBackgroundObject.contentDocument;
    if (!svgDoc) {
      return null;
    }

    const flowers = Array.from(svgDoc.querySelectorAll('g[id^="flower-"]'));
    return { svgDoc, flowers };
  };

  const setupFlowerBackgroundEasterEggs = () => {
    const context = getFlowerBackgroundContext();
    if (!context) {
      return;
    }

    const { svgDoc, flowers } = context;
    if (!flowers.length) {
      return;
    }

    setupFlowerColorShiftEasterEgg(svgDoc, flowers);
    setupFlowerPetalEasterEgg(svgDoc, flowers);
  };

  const animateFlowerBackground = () => {
    const context = getFlowerBackgroundContext();
    if (!context) {
      if (flowerBackgroundObject) {
        flowerBackgroundObject.classList.add('is-ready');
      }
      return;
    }

    const { svgDoc, flowers } = context;

    if (!flowers.length) {
      flowerBackgroundObject.classList.add('is-ready');
      return;
    }

    setupFlowerBackgroundEasterEggs();

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

    if (skipIndexLogoIntroAnimation) {
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

  const rebindFlowerBackgroundEasterEggsOnPageShow = () => {
    if (!flowerBackgroundObject) {
      return;
    }

    window.addEventListener('pageshow', () => {
      runNowOrOnObjectLoad(flowerBackgroundObject, setupFlowerBackgroundEasterEggs);
    });
  };

  const initializePage = () => {
    initPageTransitions();
    initNavInteractions();
    initLogoAnimation();
    initFlowerBackground();
    rebindFlowerBackgroundEasterEggsOnPageShow();
  };

  initializePage();
});
