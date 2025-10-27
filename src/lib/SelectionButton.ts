// SelectionButton.ts

type SelectionButtonOpts = {
  onExplainRequested: (text: string, rect: DOMRect | null) => void;
};

export class SelectionButton {
  private buttonEl: HTMLButtonElement | null = null;
  private currentSelection = '';
  private lastRect: DOMRect | null = null;
  private clickBusy = false;
  // 2. Add a property to hold the callback function
  private onLearnClickCallback: ((text: string, rect: DOMRect | null) => void) | null = null;

  constructor(/* REMOVED: opts: SelectionButtonOpts */) {
    console.log('[SelectionButton] constructor');
    // REMOVED: this.onExplainRequested = opts.onExplainRequested;

    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleButtonClick = this.handleButtonClick.bind(this);

    this.ensureButton();
  }

  public setOnLearnClick(callback: (text: string, rect: DOMRect | null) => void): void {
      this.onLearnClickCallback = callback;
  }

  public initializeListeners() {
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('mousedown', this.handleMouseDown);

    window.addEventListener('scroll', this.hide.bind(this), { passive: true });
    window.addEventListener('resize', this.hide.bind(this));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
  }

  // Create the floating button once
  private ensureButton() {
    if (this.buttonEl) return this.buttonEl;

    const btn = document.createElement('button');
    btn.id = '__lb-float-btn__'; // unique, in case page has "Learn"
    btn.textContent = 'Learn';

    Object.assign(btn.style, {
      position: 'fixed',              // KEY: viewport coords
      display: 'none',                // hidden by default
      zIndex: '10',           // top of basically everything
      background: '#111',
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      padding: '6px 10px',
      fontSize: '12px',
      lineHeight: '1.2',
      fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 4px 12px rgba(0,0,0,.25)',
      cursor: 'pointer',
      pointerEvents: 'auto',
    } as CSSStyleDeclaration);

    // Prevent some sites from nuking your selection on mousedown
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    btn.addEventListener('click', this.handleButtonClick);

    // Attach to <html> instead of <body> to dodge sites that mess with body overflow
    document.documentElement.appendChild(btn);

    this.buttonEl = btn;
    return btn;
  }

  // Mouse up = user finished highlighting text
  private handleMouseUp(ev: MouseEvent) {
    if ((ev.target as HTMLElement).id === this.buttonEl?.id) return;

    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        this.hide();
        return;
      }

      let rect: DOMRect | null = null;
      try {
        rect = sel.getRangeAt(0).getBoundingClientRect();
      } catch {
        rect = null;
      }

      const text = sel.toString().trim();

      if (
        !text ||
        !rect ||
        (rect.width === 0 && rect.height === 0)
      ) {
        this.hide();
        return;
      }

      this.currentSelection = text;
      this.lastRect = rect;
      this.placeButton(rect);
    }, 10);
  }

  // Click somewhere else? hide the bubble.
  private handleMouseDown(ev: MouseEvent) {
    if ((ev.target as HTMLElement).id !== this.buttonEl?.id) {
      this.hide();
    }
  }

  // Clicking "Learn"
  private async handleButtonClick() {
    if (this.clickBusy) return;
    if (!this.currentSelection) return;
    // 4. Check if the callback has been set
    if (!this.onLearnClickCallback) {
        console.error("SelectionButton: onLearnClickCallback not set!");
        return;
    }

    this.clickBusy = true;
    const text = this.currentSelection;
    const rect = this.lastRect;

    this.hide();

    try {
      // 5. Call the saved callback function
      this.onLearnClickCallback(text, rect ?? null);
    } finally {
      this.clickBusy = false;
    }
  }

  // Actually position the floating button next to the selection
  private placeButton(rect: DOMRect) {
    const btn = this.ensureButton();

    const gap = 8;
    // Try above the selection first
    let top = rect.top - 36;
    let left = rect.left;

    // If too close to top, move below instead
    if (top < gap) {
      top = rect.bottom + gap;
    }

    // Basic horizontal clamp to viewport
    const approxWidth = 80; // rough width of bubble
    if (left < gap) left = gap;
    if (left + approxWidth > window.innerWidth - gap) {
      left = window.innerWidth - gap - approxWidth;
    }

    btn.style.top = `${top}px`;
    btn.style.left = `${left}px`;
    btn.style.display = 'block';
  }

  public destroy() {
    // 1. Remove global event listeners
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('mousedown', this.handleMouseDown);
    
    // 2. Remove the button from the page
    if (this.buttonEl) {
      this.buttonEl.remove();
    }
    console.log('LEARNING BUDDY: Button destroyed');
  }

  private hide() {
    if (this.buttonEl) {
      this.buttonEl.style.display = 'none';
    }
    this.currentSelection = '';
    // we leave lastRect so that panel can still anchor to it after click
  }
}
