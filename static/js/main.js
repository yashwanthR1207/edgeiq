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
const heroTl = gsap.timeline({
    scrollTrigger: {
        trigger: ".hero-section",
        start: "top top",
        end: "+=4600", // Generous scroll runway so frames have plenty of travel distance and dwell time
        scrub: 1.2,    // Smooth inertia
        pin: true,
        anticipatePin: 1
    }
});

// Phase 1 (0.00 -> 0.10): Hero text fades out, visual box rises into locked position
heroTl.to(".hero-content", {
    opacity: 0,
    y: -40,
    scale: 0.95,
    ease: "power1.inOut",
    duration: 0.10,
    onUpdate: function() {
        const hc = document.querySelector('.hero-content');
        if (hc) hc.style.pointerEvents = this.progress() > 0.5 ? 'none' : 'auto';
    }
}, 0);

heroTl.fromTo(".hero-visual", 
    { opacity: 0, y: 120, scale: 0.92 }, 
    { opacity: 1, y: 0, scale: 1, ease: "power1.out", duration: 0.10 }, 
    0
);

// Phase 2 (0.10 -> 0.20): Initial hold delay - box is locked at Frame 0 so user can see it at rest

// Phase 3 (0.20 -> 0.85): The box remains firmly locked while frames scrub smoothly with frame delay
heroTl.to(frameSequence, {
    frame: frameCount - 1,
    ease: "none",
    duration: 0.65,
    onUpdate: function() {
        targetFrame = Math.min(frameCount - 1, Math.max(0, frameSequence.frame));
    }
}, 0.20);

// Phase 4 (0.85 -> 0.96): Final hold delay - holds the final frame locked in place before release

// Phase 5 (0.96 -> 1.00): Settle on last frame before releasing lock to next section
heroTl.to(".hero-visual", {
    scale: 0.98,
    opacity: 0.95,
    ease: "power1.in",
    duration: 0.04
}, 0.96);

// Quick reverse scroll accelerator: When scrolling UP in the hero sequence, quickly glide back to top
window.addEventListener('wheel', (e) => {
    const heroST = heroTl.scrollTrigger;
    if (!heroST) return;
    // When user scrolls UP (deltaY < 0) within or approaching the pinned hero section
    if (e.deltaY < 0 && window.scrollY > 0 && window.scrollY <= heroST.end + 80) {
        const target = Math.max(0, lenis.scroll + e.deltaY * 3.2);
        lenis.scrollTo(target, {
            duration: 0.35,
            immediate: false,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
        });
    }
}, { passive: true });

// 2. Opening Statement
const statementTl = gsap.timeline({
    scrollTrigger: {
        trigger: ".statement-section",
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
    }
});
statementTl.to(".statement-1", { opacity: 0, y: -50 }, 0.2)
           .to(".statement-2", { opacity: 1, y: 0 }, 0.3)
           .to(".statement-2", { opacity: 0, y: -50 }, 0.6)
           .to(".statement-3", { opacity: 1, y: 0 }, 0.7);

// 3. Problem Section - Signals Converge
gsap.from(".signal-item", {
    scrollTrigger: {
        trigger: ".signals-container",
        start: "top 80%",
        end: "center center",
        scrub: 1
    },
    x: (i) => (Math.random() - 0.5) * 500,
    y: (i) => (Math.random() - 0.5) * 500,
    opacity: 0,
    scale: 0.5,
    stagger: 0.05
});

gsap.to(".problem-item", {
    scrollTrigger: {
        trigger: ".problem-reveal",
        start: "top 80%",
        end: "center center",
        scrub: 1
    },
    opacity: 1,
    y: 0,
    stagger: 0.1
});

// 4. Core Idea - Loop words
gsap.to(".loop-word", {
    scrollTrigger: {
        trigger: ".core-loop-section",
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        pin: true
    },
    color: "#1D1D1F",
    stagger: 0.2
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
        y: 50 * (6-i),
        opacity: 0,
        scale: 0.9,
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

