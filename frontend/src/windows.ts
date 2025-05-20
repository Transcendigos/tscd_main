// src/DesktopWindow.ts (or similar file)

interface DesktopWindowOptions {
  windowId: string;
  dragHandleId: string;
  resizeHandleId: string;
  boundaryContainerId: string;
  visibilityToggleId: string;
  openTriggerId?: string;
  closeButtonId?: string;
  showClasses?: string[];
  hideClasses?: string[];
  minWindowWidth?: number;
  minWindowHeight?: number;
  initialZIndex?: number;
}

export class DesktopWindow {
  private windowElement: HTMLElement;
  private dragHandleElement: HTMLElement;
  private resizeHandleElement: HTMLElement;
  private boundaryContainerElement: HTMLElement;
  private visibilityToggleElement: HTMLElement;
  private openTriggerElement?: HTMLElement | null;
  private closeButtonElement?: HTMLElement | null;

  private showClasses: string[];
  private hideClasses: string[];
  private minWidth: number;
  private minHeight: number;
  public zIndex: number;

  private isDragging: boolean = false;
  private isResizing: boolean = false;
  private initialMouseX: number = 0;
  private initialMouseY: number = 0;
  private startWindowX: number = 0;
  private startWindowY: number = 0;
  private initialResizeMouseX: number = 0;
  private initialResizeMouseY: number = 0;
  private initialWindowWidth: number = 0;
  private initialWindowHeight: number = 0;

  private static activeWindows: DesktopWindow[] = []; // Not actively used in this version for complex focus, but good for future
  private static highestZIndex: number = 100; 

  constructor(options: DesktopWindowOptions) {
    const windowEl = document.getElementById(options.windowId);
    const dragEl = document.getElementById(options.dragHandleId);
    const resizeEl = document.getElementById(options.resizeHandleId);
    const boundaryEl = document.getElementById(options.boundaryContainerId);
    const visibilityEl = document.getElementById(options.visibilityToggleId);

    if (!windowEl || !dragEl || !resizeEl || !boundaryEl || !visibilityEl) {
      console.error(`DesktopWindow init failed: One or more essential elements not found for window base ID '${options.windowId}'.`);
      throw new Error(`Essential elements missing for window ${options.windowId}`);
    }
    this.windowElement = windowEl;
    this.dragHandleElement = dragEl;
    this.resizeHandleElement = resizeEl;
    this.boundaryContainerElement = boundaryEl;
    this.visibilityToggleElement = visibilityEl;

    if (options.openTriggerId) {
      this.openTriggerElement = document.getElementById(options.openTriggerId);
    }
    if (options.closeButtonId) {
      this.closeButtonElement = document.getElementById(options.closeButtonId);
    }

    this.showClasses = options.showClasses || ['opacity-100', 'scale-100', 'visible', 'pointer-events-auto'];
    this.hideClasses = options.hideClasses || ['opacity-0', 'scale-10', 'invisible', 'pointer-events-none'];
    this.minWidth = options.minWindowWidth || 200;
    this.minHeight = options.minWindowHeight || 300;
    
    // Assign initial z-index and increment the global highest for the next window
    this.zIndex = options.initialZIndex !== undefined ? options.initialZIndex : DesktopWindow.highestZIndex;
    if (this.zIndex >= DesktopWindow.highestZIndex) {
        DesktopWindow.highestZIndex = this.zIndex + 1;
    }
    this.windowElement.style.zIndex = this.zIndex.toString();

    this._initEventListeners();
    this._updateMinDimensions();
    DesktopWindow.activeWindows.push(this); // Keep track of windows
  }

  private _initEventListeners(): void {
    this.dragHandleElement.addEventListener('mousedown', this._onDragStart);
    this.dragHandleElement.addEventListener('touchstart', this._onDragStart, { passive: false });

    this.resizeHandleElement.addEventListener('mousedown', this._onResizeStart);
    this.resizeHandleElement.addEventListener('touchstart', this._onResizeStart, { passive: false });

    if (this.openTriggerElement) {
      this.openTriggerElement.addEventListener('click', this.open);
    }
    if (this.closeButtonElement) {
      this.closeButtonElement.addEventListener('click', this.close);
    }
    
    this.windowElement.addEventListener('mousedown', this._bringToFront, true); // Use capture to ensure it fires early for z-index
  }
  
  private _bringToFront = (): void => {
    // Check if this window is not already the topmost or among the topmost
    let maxZ = 0;
    DesktopWindow.activeWindows.forEach(win => {
        if (win.zIndex > maxZ) {
            maxZ = win.zIndex;
        }
    });
    DesktopWindow.highestZIndex = maxZ +1; // update static highest based on current max

    if (this.zIndex < DesktopWindow.highestZIndex -1 || DesktopWindow.activeWindows.length === 1) {
        this.zIndex = DesktopWindow.highestZIndex;
        this.windowElement.style.zIndex = this.zIndex.toString();
        DesktopWindow.highestZIndex++; // Increment for the next new top window
    }
  }

  public open = (): void => {
    this.visibilityToggleElement.classList.remove(...this.hideClasses);
    this.visibilityToggleElement.classList.add(...this.showClasses);
    this._bringToFront();
  }

  public close = (): void => {
    this.visibilityToggleElement.classList.remove(...this.showClasses);
    this.visibilityToggleElement.classList.add(...this.hideClasses);
  }

  private _updateMinDimensions = (): void => {
    const style = window.getComputedStyle(this.windowElement);
    const mw = parseInt(style.minWidth, 10);
    const mh = parseInt(style.minHeight, 10);
    if (!isNaN(mw) && mw > 0) this.minWidth = mw;
    if (!isNaN(mh) && mh > 0) this.minHeight = mh;
  }

  private _onDragStart = (event: MouseEvent | TouchEvent): void => {
    if (this.isResizing) return;
    this._bringToFront();

    const parentRect = this.boundaryContainerElement.getBoundingClientRect();
    const windowRect = this.windowElement.getBoundingClientRect();
    const initialLeftRelativeToParent = windowRect.left - parentRect.left;
    const initialTopRelativeToParent = windowRect.top - parentRect.top;

    this.windowElement.style.transform = 'none';
    this.windowElement.style.left = `${initialLeftRelativeToParent}px`;
    this.windowElement.style.top = `${initialTopRelativeToParent}px`;
    this.startWindowX = initialLeftRelativeToParent;
    this.startWindowY = initialTopRelativeToParent;

    if (event instanceof MouseEvent) {
      this.initialMouseX = event.clientX;
      this.initialMouseY = event.clientY;
    } else {
      this.initialMouseX = (event as TouchEvent).touches[0].clientX;
      this.initialMouseY = (event as TouchEvent).touches[0].clientY;
    }

    this.isDragging = true;
    this.dragHandleElement.style.cursor = 'grabbing';
    this.windowElement.style.willChange = 'left, top';

    document.addEventListener('mousemove', this._onDragMove);
    document.addEventListener('touchmove', this._onDragMove, { passive: false });
    document.addEventListener('mouseup', this._onDragEnd);
    document.addEventListener('touchend', this._onDragEnd);
  }

  private _onDragMove = (event: MouseEvent | TouchEvent): void => {
    if (!this.isDragging) return;
    event.preventDefault();
    let currentMouseX, currentMouseY;
    if (event instanceof MouseEvent) {
      currentMouseX = event.clientX;
      currentMouseY = event.clientY;
    } else {
      currentMouseX = (event as TouchEvent).touches[0].clientX;
      currentMouseY = (event as TouchEvent).touches[0].clientY;
    }
    const deltaX = currentMouseX - this.initialMouseX;
    const deltaY = currentMouseY - this.initialMouseY;
    this.windowElement.style.left = `${this.startWindowX + deltaX}px`;
    this.windowElement.style.top = `${this.startWindowY + deltaY}px`;
  }

  private _onDragEnd = (): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.dragHandleElement.style.cursor = 'grab';
    this.windowElement.style.willChange = 'auto';

    const finalWindowRect = this.windowElement.getBoundingClientRect();
    const parentRect = this.boundaryContainerElement.getBoundingClientRect();
    let finalPixelLeft = finalWindowRect.left - parentRect.left;
    let finalPixelTop = finalWindowRect.top - parentRect.top;
    
    const windowWidth = this.windowElement.offsetWidth; // Use offsetWidth for current width
    const windowHeight = this.windowElement.offsetHeight; // Use offsetHeight for current height
    const parentWidth = parentRect.width;
    const parentHeight = parentRect.height;

    if (finalPixelLeft < 0) finalPixelLeft = 0;
    if (finalPixelTop < 0) finalPixelTop = 0;
    
    if (windowWidth >= parentWidth) {
        finalPixelLeft = 0;
    } else if (finalPixelLeft + windowWidth > parentWidth) {
        finalPixelLeft = parentWidth - windowWidth;
    }

    if (windowHeight >= parentHeight) {
        finalPixelTop = 0;
    } else if (finalPixelTop + windowHeight > parentHeight) {
        finalPixelTop = parentHeight - windowHeight;
    }
    
    finalPixelLeft = Math.max(0, finalPixelLeft);
    finalPixelTop = Math.max(0, finalPixelTop);

    if (parentWidth > 0 && parentHeight > 0) {
      this.windowElement.style.left = `${(finalPixelLeft / parentWidth) * 100}%`;
      this.windowElement.style.top = `${(finalPixelTop / parentHeight) * 100}%`;
    } else {
      this.windowElement.style.left = `${finalPixelLeft}px`;
      this.windowElement.style.top = `${finalPixelTop}px`;
    }

    document.removeEventListener('mousemove', this._onDragMove);
    document.removeEventListener('touchmove', this._onDragMove);
    document.removeEventListener('mouseup', this._onDragEnd);
    document.removeEventListener('touchend', this._onDragEnd);
  }

  private _onResizeStart = (event: MouseEvent | TouchEvent): void => {
    if (this.isDragging) return;
    event.stopPropagation(); // Prevent this mousedown from triggering parent's mousedown (e.g. _bringToFront on windowElement)
    this._bringToFront();
    this._updateMinDimensions();

    this.isResizing = true;
    this.windowElement.style.willChange = 'width, height, left, top';
    const parentRect = this.boundaryContainerElement.getBoundingClientRect();
    const windowRect = this.windowElement.getBoundingClientRect();
    const currentPixelLeft = windowRect.left - parentRect.left;
    const currentPixelTop = windowRect.top - parentRect.top;

    if (this.windowElement.style.transform !== 'none' && this.windowElement.style.transform !== '') {
      this.windowElement.style.transform = 'none';
    }
    this.windowElement.style.left = `${currentPixelLeft}px`;
    this.windowElement.style.top = `${currentPixelTop}px`;

    if (event instanceof MouseEvent) {
      this.initialResizeMouseX = event.clientX;
      this.initialResizeMouseY = event.clientY;
    } else {
      this.initialResizeMouseX = (event as TouchEvent).touches[0].clientX;
      this.initialResizeMouseY = (event as TouchEvent).touches[0].clientY;
    }
    this.initialWindowWidth = this.windowElement.offsetWidth;
    this.initialWindowHeight = this.windowElement.offsetHeight;
    this.windowElement.style.width = `${this.initialWindowWidth}px`;
    this.windowElement.style.height = `${this.initialWindowHeight}px`;

    document.addEventListener('mousemove', this._onResizeMove);
    document.addEventListener('touchmove', this._onResizeMove, { passive: false });
    document.addEventListener('mouseup', this._onResizeEnd);
    document.addEventListener('touchend', this._onResizeEnd);
  }

  private _onResizeMove = (event: MouseEvent | TouchEvent): void => {
    if (!this.isResizing) return;
    event.preventDefault();
    let currentMouseX, currentMouseY;
    if (event instanceof MouseEvent) {
      currentMouseX = event.clientX;
      currentMouseY = event.clientY;
    } else {
      currentMouseX = (event as TouchEvent).touches[0].clientX;
      currentMouseY = (event as TouchEvent).touches[0].clientY;
    }
    const deltaX = currentMouseX - this.initialResizeMouseX;
    const deltaY = currentMouseY - this.initialResizeMouseY;
    let newWidth = this.initialWindowWidth + deltaX;
    let newHeight = this.initialWindowHeight + deltaY;

    newWidth = Math.max(newWidth, this.minWidth);
    newHeight = Math.max(newHeight, this.minHeight);
    const parentRect = this.boundaryContainerElement.getBoundingClientRect();
    const currentLeft = parseFloat(this.windowElement.style.left); // This is in px
    const currentTop = parseFloat(this.windowElement.style.top);   // This is in px

    if (currentLeft + newWidth > parentRect.width) {
      newWidth = parentRect.width - currentLeft;
    }
    if (currentTop + newHeight > parentRect.height) {
      newHeight = parentRect.height - currentTop;
    }
    newWidth = Math.max(newWidth, this.minWidth); 
    newHeight = Math.max(newHeight, this.minHeight);

    this.windowElement.style.width = `${newWidth}px`;
    this.windowElement.style.height = `${newHeight}px`;
  }

  private _onResizeEnd = (): void => {
    if (!this.isResizing) return;
    this.isResizing = false;
    this.windowElement.style.willChange = 'auto';

    // --- Convert position back to percentage after resize ---
    const finalWindowRect = this.windowElement.getBoundingClientRect();
    const parentRect = this.boundaryContainerElement.getBoundingClientRect();
    
    let finalPixelLeft = finalWindowRect.left - parentRect.left;
    let finalPixelTop = finalWindowRect.top - parentRect.top;

    const windowWidth = this.windowElement.offsetWidth; // Current width after resize
    const windowHeight = this.windowElement.offsetHeight; // Current height after resize
    const parentWidth = parentRect.width;
    const parentHeight = parentRect.height;

    // Apply boundary checks, similar to _onDragEnd
    if (finalPixelLeft < 0) finalPixelLeft = 0;
    if (finalPixelTop < 0) finalPixelTop = 0;

    if (windowWidth >= parentWidth) { // If window is wider/equal to parent, pin to left
        finalPixelLeft = 0;
    } else if (finalPixelLeft + windowWidth > parentWidth) { // Otherwise, ensure it doesn't overflow right
        finalPixelLeft = parentWidth - windowWidth;
    }

    if (windowHeight >= parentHeight) { // If window is taller/equal to parent, pin to top
        finalPixelTop = 0;
    } else if (finalPixelTop + windowHeight > parentHeight) { // Otherwise, ensure it doesn't overflow bottom
        finalPixelTop = parentHeight - windowHeight;
    }
    
    finalPixelLeft = Math.max(0, finalPixelLeft); // Ensure not negative
    finalPixelTop = Math.max(0, finalPixelTop);   // Ensure not negative

    if (parentWidth > 0 && parentHeight > 0) {
      this.windowElement.style.left = `${(finalPixelLeft / parentWidth) * 100}%`;
      this.windowElement.style.top = `${(finalPixelTop / parentHeight) * 100}%`;
    } else {
      // Fallback if parent has no dimensions
      this.windowElement.style.left = `${finalPixelLeft}px`;
      this.windowElement.style.top = `${finalPixelTop}px`;
    }
    // --- End of percentage conversion ---

    document.removeEventListener('mousemove', this._onResizeMove);
    document.removeEventListener('touchmove', this._onResizeMove);
    document.removeEventListener('mouseup', this._onResizeEnd);
    document.removeEventListener('touchend', this._onResizeEnd);
  }
}