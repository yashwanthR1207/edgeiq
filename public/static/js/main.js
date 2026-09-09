// Initialize Lenis for smooth scrolling
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
    infinite: false,
})

function raf(time) {
    lenis.raf(time)
    requestAnimationFrame(raf)
}

requestAnimationFrame(raf)

// Initialize GSAP ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

// Update ScrollTrigger on Lenis scroll
lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time)=>{
  lenis.raf(time * 1000)
});
gsap.ticker.lagSmoothing(0);



// --- Overview Frame Sequence & Lock ScrollFlow ---
const frameCount = 58;
const overviewFrames = [];
const frameSequence = { frame: 0 };
let currentRenderedFrame = -1;

const canvas = document.getElementById('overview-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const fallbackImg = document.getElementById('overview-fallback-img');

function getFrameUrl(index) {
    const padded = String(index).padStart(2, '0');
    return `/public/overview_hd/frame_${padded}.png`;
}

function renderFrame(index) {
    if (!canvas || !ctx) return;
    const idx = Math.min(frameCount - 1, Math.max(0, index));
    currentRenderedFrame = idx;

    let img = overviewFrames[idx];
    // If target frame isn't loaded yet, pick the closest loaded frame for zero flicker
    if (!img || !img.complete || img.naturalWidth === 0) {
        for (let d = 1; d < frameCount; d++) {
            if (idx - d >= 0 && overviewFrames[idx - d]?.complete && overviewFrames[idx - d].naturalWidth > 0) {
                img = overviewFrames[idx - d];
                break;
            }
            if (idx + d < frameCount && overviewFrames[idx + d]?.complete && overviewFrames[idx + d].naturalWidth > 0) {
                img = overviewFrames[idx + d];
                break;
            }
        }
    }

    if (!img || !img.complete || img.naturalWidth === 0) return;

    // High resolution backing store (true 2K / retina crispness)
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);

    const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
    const x = (rect.width - img.naturalWidth * scale) / 2;
    const y = (rect.height - img.naturalHeight * scale) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x, y, img.naturalWidth * scale, img.naturalHeight * scale);
    ctx.restore();

    if (fallbackImg && fallbackImg.style.opacity !== '0') {
        fallbackImg.style.opacity = '0';
    }
}

// Preload frames in memory
for (let i = 0; i < frameCount; i++) {
    const img = new Image();
    img.src = getFrameUrl(i);
    img.onerror = () => {
        const padded = String(i).padStart(2, '0');
        if (img.src.includes('/public/')) {
            img.src = `/overview_hd/frame_${padded}.png`;
        } else {
            img.src = `/public/overview_hd/frame_${padded}.png`;
        }
    };
    img.onload = () => {
        if (i === 0 && currentRenderedFrame === -1) {
            renderFrame(0);
        }
    };
    overviewFrames.push(img);
}

if (overviewFrames[0] && overviewFrames[0].complete) {
    renderFrame(0);
}

window.addEventListener('resize', () => {
    if (currentRenderedFrame >= 0) {
        renderFrame(currentRenderedFrame);
    }
});

// --- Smooth Frame Interpolation & Pacing Engine ---
let targetFrame = 0;
let displayedFrame = 0;

function tickFrames() {
    const diff = targetFrame - displayedFrame;
    if (Math.abs(diff) > 0.005) {
        // Controlled frame catch-up: ensures every frame displays with a tactile delay
        displayedFrame += diff * 0.12;
        const idx = Math.min(frameCount - 1, Math.max(0, Math.round(displayedFrame)));
        if (idx !== currentRenderedFrame) {
            renderFrame(idx);
        }
    }
    requestAnimationFrame(tickFrames);
}
requestAnimationFrame(tickFrames);

// Animations

// 1. Hero Animation & Locked Frame Sequence
const heroMm = gsap.matchMedia();

// Desktop / Tablet (>= 768px): Horizontal split
// Edge IQ symbol glides from center to the right side of the box
// Device box glides smoothly to the left side
// In the hero frame, logo shrinks and moves up as the statement reveals below it
heroMm.add("(min-width: 768px)", () => {
    const heroTl = gsap.timeline({
        scrollTrigger: {
            id: "heroPin",
            trigger: ".hero-section",
            start: "top top",
            end: "+=5200",
            scrub: 1.2,
            pin: true,
            anticipatePin: 1
        }
    });

    // Phase 1 (0.00 -> 0.16):
    // Edge IQ symbol glides smoothly from center to the right side
    heroTl.to(".hero-content", {
        x: "24vw",
        y: 0,
        scale: 0.95,
        opacity: 1,
        ease: "power2.out",
        duration: 0.16
    }, 0);

    // Box glides smoothly to the left side
    heroTl.fromTo(".hero-visual", 
        { opacity: 0, x: "0vw", y: 45, scale: 0.92 }, 
        { opacity: 1, x: "-20vw", y: 0, scale: 1, ease: "power2.out", duration: 0.16 }, 
        0
    );

    // Phase 2 (0.16 -> 0.58): Device scrubs rotation frames 0 -> 57 into the hero perspective
    heroTl.to(frameSequence, {
        frame: frameCount - 1,
        ease: "none",
        duration: 0.42,
        onUpdate: function() {
            targetFrame = Math.min(frameCount - 1, Math.max(0, frameSequence.frame));
        }
    }, 0.16);

    // Phase 3 (0.58 -> 0.78):
    // In this frame, the Edge IQ logo shrinks smoothly and moves up
    heroTl.to("#hero-logo-img", {
        scale: 0.76,
        y: -24,
        ease: "power2.out",
        duration: 0.18
    }, 0.58);

    // And the sentence block smoothly comes in below the logo
    heroTl.fromTo(".hero-statement",
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, ease: "power2.out", duration: 0.18 },
        0.58
    );

    // Subtle sequential illumination of the three statements
    heroTl.fromTo(".hero-stmt-1",
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, ease: "power2.out", duration: 0.10 },
        0.58
    );
    heroTl.fromTo(".hero-stmt-2",
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, ease: "power2.out", duration: 0.12 },
        0.65
    );
    heroTl.fromTo(".hero-stmt-3",
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, ease: "power2.out", duration: 0.12 },
        0.72
    );

    // Phase 4 (0.78 -> 0.94): Hold delay - box is locked at hero frame 57, logo & statement beautifully displayed

    // Phase 5 (0.94 -> 1.00): Smooth release / exit into next section
    heroTl.to([".hero-content", ".hero-visual"], {
        opacity: 0,
        y: -40,
        ease: "power1.in",
        duration: 0.06
    }, 0.94);
});

// Mobile (< 768px): Vertical split
// Symbol glides UP, Box moves into center below
heroMm.add("(max-width: 767px)", () => {
    const heroTl = gsap.timeline({
        scrollTrigger: {
            id: "heroPin",
            trigger: ".hero-section",
            start: "top top",
            end: "+=4200",
            scrub: 1.2,
            pin: true,
            anticipatePin: 1
        }
    });

    heroTl.to(".hero-content", {
        x: 0,
        y: "-26vh",
        scale: 0.85,
        opacity: 1,
        ease: "power2.out",
        duration: 0.16
    }, 0);

    heroTl.fromTo(".hero-visual", 
        { opacity: 0, x: 0, y: 60, scale: 0.9 }, 
        { opacity: 1, x: 0, y: "10vh", scale: 1, ease: "power2.out", duration: 0.16 }, 
        0
    );

    heroTl.to(frameSequence, {
        frame: frameCount - 1,
        ease: "none",
        duration: 0.42,
        onUpdate: function() {
            targetFrame = Math.min(frameCount - 1, Math.max(0, frameSequence.frame));
        }
    }, 0.16);

    heroTl.to("#hero-logo-img", {
        scale: 0.70,
        y: -16,
        ease: "power2.out",
        duration: 0.18
    }, 0.58);

    heroTl.fromTo(".hero-statement",
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, ease: "power2.out", duration: 0.18 },
        0.58
    );

    heroTl.to([".hero-content", ".hero-visual"], {
        opacity: 0,
        y: -40,
        ease: "power1.in",
        duration: 0.06
    }, 0.94);
});





// 5. Architecture Layers
gsap.utils.toArray(".layer-card").forEach((layer, i) => {
    gsap.from(layer, {
        scrollTrigger: {
            trigger: ".architecture-stack",
            start: "top 80%",
            end: "center center",
            scrub: 1
        },
        y: 30 * (i + 1),
        opacity: 0,
        scale: 0.95,
    });
});

// 6. Edge AI - Technical Labels
gsap.from(".technical-labels p", {
    scrollTrigger: {
        trigger: ".technical-labels",
        start: "top 80%",
        end: "center center",
        scrub: 1
    },
    x: -50,
    opacity: 0,
    stagger: 0.1
});

// 7. Hardware Labels
gsap.to(".hw-label", {
    scrollTrigger: {
        trigger: ".hardware-labels",
        start: "top 60%",
        end: "center center",
        scrub: 1
    },
    opacity: 1,
    y: 0,
    stagger: 0.2
});

// 8. CV Capabilities
gsap.to(".cv-capabilities div", {
    scrollTrigger: {
        trigger: ".cv-capabilities",
        start: "top 80%",
        end: "center center",
        scrub: 1
    },
    opacity: 1,
    y: 0,
    stagger: 0.05
});


// 9. Queue Alert
gsap.to(".queue-alert", {
    scrollTrigger: {
        trigger: ".queue-alert",
        start: "top 60%",
        end: "center center",
        scrub: 1
    },
    opacity: 1,
    y: 0
});

// 10. ERP Flow
gsap.from(".erp-flow > div", {
    scrollTrigger: {
        trigger: ".erp-flow",
        start: "top 80%",
        end: "bottom center",
        scrub: 1
    },
    opacity: 0.2,
    y: 20,
    stagger: 0.2
});

// 11. Privacy Flow
gsap.from(".privacy-flow > div", {
    scrollTrigger: {
        trigger: ".privacy-flow",
        start: "top 80%",
        end: "bottom center",
        scrub: 1
    },
    opacity: 0,
    x: 50,
    stagger: 0.1
});

// 12. Closed Loop
const clTl = gsap.timeline({
    scrollTrigger: {
        trigger: ".closed-loop-section",
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        pin: true
    }
});

clTl.to(".cl-word", { opacity: 1, color: "#FFFFFF", stagger: 0.1 })
    .to(".cl-arrow", { color: "#32ADE6", stagger: 0.1 }, "<")
    .to(".cl-loop-svg", { opacity: 1 }, 0.5)
    .to(".cl-subtext", { opacity: 1, y: -20 }, 0.8);

// 13. Future Network
gsap.to(".future-list p", {
    scrollTrigger: {
        trigger: ".future-list",
        start: "top 80%",
        end: "center center",
        scrub: 1
    },
    opacity: 1,
    y: 0,
    stagger: 0.05
});

gsap.from(".network-expansion span", {
    scrollTrigger: {
        trigger: ".network-expansion",
        start: "top 80%",
        end: "center center",
        scrub: 1
    },
    opacity: 0,
    scale: 0.8,
    stagger: 0.2
});

// 14. Final Section
const finalTl = gsap.timeline({
    scrollTrigger: {
        trigger: ".final-section",
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        pin: true
    }
});

finalTl.to(".final-text-1", { opacity: 0 }, 0.2)
       .to(".final-text-2", { opacity: 1 }, 0.3)
       .to(".final-text-2", { opacity: 0, scale: 0.9 }, 0.6)
       .to(".final-brand", { opacity: 1, y: 0 }, 0.7);

