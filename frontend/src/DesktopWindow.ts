// tscd_main/frontend/src/DesktopWindow.ts

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
  maxWindowWidth?: number;
  maxWindowHeight?: number;
  initialZIndex?: number;
  initialShow?: boolean; // Explicit option to show initially
  onCloseCallback?: () => void;
}

export class DesktopWindow {
  public element: HTMLElement;
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
  private maxWidth: number;
  private maxHeight : number;
  public zIndex: number;

  private isDragging: boolean = false;
  private isResizing: boolean = false;

  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;

  private initialResizeMouseX: number = 0;
  private initialResizeMouseY: number = 0;
  private initialWindowWidth: number = 0;
  private initialWindowHeight: number = 0;

  private static activeWindows: DesktopWindow[] = [];
  private static highestZIndex: number = 50;

  private onCloseCallback?: () => void;
  private config: DesktopWindowOptions; // Store config


  constructor(options: DesktopWindowOptions) {
    this.config = options; // Store options

    const windowEl = document.getElementById(options.windowId);
    const dragEl = document.getElementById(options.dragHandleId);
    const resizeEl = document.getElementById(options.resizeHandleId);
    const boundaryEl = document.getElementById(options.boundaryContainerId);
    const visibilityEl = document.getElementById(options.visibilityToggleId);

    if (!windowEl || !dragEl || !resizeEl || !boundaryEl || !visibilityEl) {
      console.error("Missing elements for window:", options.windowId, {
          windowEl: !!windowEl,
          dragEl: !!dragEl,
          resizeEl: !!resizeEl,
          boundaryEl: !!boundaryEl,
          visibilityEl: !!visibilityEl
      });
      throw new Error(`Essential elements missing for window ${options.windowId}. Check IDs: windowId, dragHandleId, resizeHandleId, boundaryContainerId, visibilityToggleId.`);
    }
    this.element = windowEl;
    this.dragHandleElement = dragEl;
    this.resizeHandleElement = resizeEl;
    this.boundaryContainerElement = boundaryEl;
    this.visibilityToggleElement = visibilityEl;

    if (options.openTriggerId) {
      this.openTriggerElement = document.getElementById(options.openTriggerId);
    }
    if (options.closeButtonId) {
      this.closeButtonElement = document.getElementById(options.closeButtonId);
      if (!this.closeButtonElement) {
        console.warn(`Close button with ID '${options.closeButtonId}' not found for window '${options.windowId}'.`);
      }
    }

    this.showClasses = options.showClasses || ['opacity-100', 'scale-100', 'visible', 'pointer-events-auto'];
    this.hideClasses = options.hideClasses || ['opacity-0', 'scale-95', 'invisible', 'pointer-events-none'];
    this.minWidth = options.minWindowWidth || 200;
    this.minHeight = options.minWindowHeight || 150;
    this.maxWidth = options.maxWindowWidth || Number.MAX_SAFE_INTEGER;
    this.maxHeight = options.maxWindowHeight || Number.MAX_SAFE_INTEGER;
    this.onCloseCallback = options.onCloseCallback;

    this.zIndex = options.initialZIndex !== undefined ? options.initialZIndex : DesktopWindow.highestZIndex;
    if (this.zIndex >= DesktopWindow.highestZIndex) {
        DesktopWindow.highestZIndex = this.zIndex + 1;
    }
    this.element.style.zIndex = this.zIndex.toString();

    this._initEventListeners();
    this._updateMinDimensions();
    this._updateMaxDimensions();

    // --- CORRECTED INITIAL VISIBILITY LOGIC ---
    // By default, windows start hidden unless explicitly told to show,
    // or if their openTriggerId is the same as their windowId (implying it's a self-opening/always-present window like a main menu).
    // The `initialShow` in the constructor of dynamic chat windows in chatClient.ts is set to `false`,
    // and then `newWindowInstance.open()` is called.
    if (options.initialShow === true || (this.openTriggerElement && this.openTriggerElement.id === this.element.id)) {
        this.visibilityToggleElement.classList.remove(...this.hideClasses);
        this.visibilityToggleElement.classList.add(...this.showClasses);
        this._bringToFront(); 
    } else {
        this.visibilityToggleElement.classList.remove(...this.showClasses);
        this.visibilityToggleElement.classList.add(...this.hideClasses);
    }
    
    DesktopWindow.activeWindows.push(this);
  }

  private _initEventListeners(): void {
    this.dragHandleElement.addEventListener('mousedown', this._onDragStart);
    this.dragHandleElement.addEventListener('touchstart', this._onDragStart, { passive: false });

    this.resizeHandleElement.addEventListener('mousedown', this._onResizeStart);
    this.resizeHandleElement.addEventListener('touchstart', this._onResizeStart, { passive: false });

    if (this.openTriggerElement && this.openTriggerElement.id !== this.element.id) { // Only add listener if trigger is not self
      this.openTriggerElement.addEventListener('click', this.open);
    }
    if (this.closeButtonElement) {
      this.closeButtonElement.addEventListener('click', this.close);
    }

    this.element.addEventListener('mousedown', this._bringToFront, true);
  }

  private _bringToFront = (): void => {
    let currentMaxZ = 0;
    DesktopWindow.activeWindows.forEach(win => {
        if (win !== this && parseInt(win.element.style.zIndex || '0') > currentMaxZ) {
            currentMaxZ = parseInt(win.element.style.zIndex || '0');
        }
    });
    const newZIndex = currentMaxZ + 1;
    // Ensure newZIndex is at least the base highestZIndex if all other windows are somehow lower
    const trulyHighestZ = Math.max(newZIndex, DesktopWindow.highestZIndex -1);

    if (this.zIndex < trulyHighestZ || DesktopWindow.activeWindows.length === 1) {
        this.zIndex = trulyHighestZ;
        this.element.style.zIndex = this.zIndex.toString();
        if (this.zIndex >= DesktopWindow.highestZIndex) {
             DesktopWindow.highestZIndex = this.zIndex + 1;
        }
    }
  }

  public open = (): void => {
    this.visibilityToggleElement.style.transition = ''; 
    this.visibilityToggleElement.classList.remove(...this.hideClasses);
    this.visibilityToggleElement.classList.add(...this.showClasses);
    this.visibilityToggleElement.style.transform = ''; 
    this._bringToFront();
  }

  public close = (): void => {
    this.visibilityToggleElement.style.transition = '';
    this.visibilityToggleElement.classList.remove(...this.showClasses);
    this.visibilityToggleElement.classList.add(...this.hideClasses);
    this.visibilityToggleElement.style.transform = '';
    if (this.onCloseCallback) {
        this.onCloseCallback();
    }
  }

  public isVisible(): boolean {
    if (!this.visibilityToggleElement) {
        return false; 
    }
    const isCurrentlyVisible = this.visibilityToggleElement.classList.contains(this.showClasses.find(c => c === 'visible') || 'visible') &&
                             !this.visibilityToggleElement.classList.contains(this.hideClasses.find(c => c === 'invisible') || 'invisible');
    return isCurrentlyVisible;
  }

  private _updateMinDimensions = (): void => {
    const style = window.getComputedStyle(this.element);
    const mw = parseInt(style.minWidth, 10);
    const mh = parseInt(style.minHeight, 10);
    if (!isNaN(mw) && mw > 0) this.minWidth = mw;
    if (!isNaN(mh) && mh > 0) this.minHeight = mh;
  }

  private _updateMaxDimensions = (): void => {
    const style = window.getComputedStyle(this.element);
    const mw = parseInt(style.maxWidth, 10);
    const mh = parseInt(style.maxHeight, 10);
    if (!isNaN(mw) && mw > 0) this.maxWidth = mw;
    if (!isNaN(mh) && mh > 0) this.maxHeight = mh;
  }

  private _onDragStart = (event: MouseEvent | TouchEvent): void => {
    event.preventDefault();
    if (this.isResizing) return;
    this._bringToFront();

    this.element.style.transition = 'none';
    // Ensure window is visible for dragging, if it was hidden
    this.element.classList.remove(...this.hideClasses);
    this.element.classList.add(...this.showClasses);
    void this.element.offsetHeight;

    const rectBeforeCompensation = this.element.getBoundingClientRect();
    const parentRect = this.boundaryContainerElement.getBoundingClientRect();
    const visualLeftRelParent = rectBeforeCompensation.left - parentRect.left;
    const visualTopRelParent = rectBeforeCompensation.top - parentRect.top;

    const compensatedPixelLeft = visualLeftRelParent + (rectBeforeCompensation.width / 2);
    const compensatedPixelTop = visualTopRelParent + (rectBeforeCompensation.height / 2);

    this.element.style.transform = 'none';
    this.element.style.left = `${compensatedPixelLeft}px`;
    this.element.style.top = `${compensatedPixelTop}px`;
    void this.element.offsetHeight;

    const stableWindowRect = this.element.getBoundingClientRect();
    const evt = (event instanceof MouseEvent) ? event : event.touches[0];
    const clickClientX = evt.clientX;
    const clickClientY = evt.clientY;

    this.dragOffsetX = clickClientX - stableWindowRect.left;
    this.dragOffsetY = clickClientY - stableWindowRect.top;

    this.isDragging = true;
    this.dragHandleElement.style.cursor = 'grabbing';
    this.element.style.willChange = 'left, top';

    document.addEventListener('mousemove', this._onDragMove);
    document.addEventListener('touchmove', this._onDragMove, { passive: false });
    document.addEventListener('mouseup', this._onDragEnd);
    document.addEventListener('touchend', this._onDragEnd);
  }

  private _onDragMove = (event: MouseEvent | TouchEvent): void => {
    if (!this.isDragging) return;
    event.preventDefault();

    const evt = (event instanceof MouseEvent) ? event : event.touches[0];
    const currentMouseX_v = evt.clientX;
    const currentMouseY_v = evt.clientY;

    const parentRect_v = this.boundaryContainerElement.getBoundingClientRect();

    const targetVisualLeft_v = currentMouseX_v - this.dragOffsetX;
    const targetVisualTop_v = currentMouseY_v - this.dragOffsetY;

    const targetVisualPixelLeft_p = targetVisualLeft_v - parentRect_v.left;
    const targetVisualPixelTop_p = targetVisualTop_v - parentRect_v.top;

    const windowWidthCurrent = this.element.offsetWidth;
    const windowHeightCurrent = this.element.offsetHeight;

    const styleLeftToSet_p = targetVisualPixelLeft_p + (windowWidthCurrent / 2);
    const styleTopToSet_p = targetVisualPixelTop_p + (windowHeightCurrent / 2);

    this.element.style.left = `${styleLeftToSet_p}px`;
    this.element.style.top = `${styleTopToSet_p}px`;
  }

  private _onDragEnd = (): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.dragHandleElement.style.cursor = 'grab';
    this.element.style.willChange = 'auto';

    const finalRectPxView = this.element.getBoundingClientRect();
    const parentRect = this.boundaryContainerElement.getBoundingClientRect();
    let finalVisualPixelLeftRelParent = finalRectPxView.left - parentRect.left;
    let finalVisualPixelTopRelParent = finalRectPxView.top - parentRect.top;

    const windowWidth = this.element.offsetWidth;
    const windowHeight = this.element.offsetHeight;
    const parentWidth = parentRect.width;
    const parentHeight = parentRect.height;

    let boundedVisualPixelLeft = finalVisualPixelLeftRelParent;
    let boundedVisualPixelTop = finalVisualPixelTopRelParent;

    if (boundedVisualPixelLeft < 0) boundedVisualPixelLeft = 0;
    if (boundedVisualPixelTop < 0) boundedVisualPixelTop = 0;
    if (windowWidth >= parentWidth && parentWidth > 0) {
        boundedVisualPixelLeft = 0;
    } else if (boundedVisualPixelLeft + windowWidth > parentWidth && parentWidth > 0) {
        boundedVisualPixelLeft = parentWidth - windowWidth;
    }
    if (windowHeight >= parentHeight && parentHeight > 0) {
        boundedVisualPixelTop = 0;
    } else if (boundedVisualPixelTop + windowHeight > parentHeight && parentHeight > 0) {
        boundedVisualPixelTop = parentHeight - windowHeight;
    }
    boundedVisualPixelLeft = Math.max(0, boundedVisualPixelLeft);
    boundedVisualPixelTop = Math.max(0, boundedVisualPixelTop);

    let newStyleLeft, newStyleTop;
    if (parentWidth > 0 && parentHeight > 0) {
      const targetCssOriginLeftPx = boundedVisualPixelLeft + (windowWidth / 2);
      const targetCssOriginTopPx = boundedVisualPixelTop + (windowHeight / 2);
      const percentLeft = (targetCssOriginLeftPx / parentWidth) * 100;
      const percentTop = (targetCssOriginTopPx / parentHeight) * 100;
      newStyleLeft = `${percentLeft}%`;
      newStyleTop = `${percentTop}%`;
    } else {
      newStyleLeft = `${boundedVisualPixelLeft + (windowWidth / 2)}px`;
      newStyleTop = `${boundedVisualPixelTop + (windowHeight / 2)}px`;
    }

    this.element.style.transform = '';
    this.element.style.left = newStyleLeft;
    this.element.style.top = newStyleTop;
    void this.element.offsetHeight;
    this.element.style.transition = '';

    document.removeEventListener('mousemove', this._onDragMove);
    document.removeEventListener('touchmove', this._onDragMove);
    document.removeEventListener('mouseup', this._onDragEnd);
    document.removeEventListener('touchend', this._onDragEnd);
  }

  private _onResizeStart = (event: MouseEvent | TouchEvent): void => {
    event.preventDefault();
    if (this.isDragging) return;
    event.stopPropagation();
    this._bringToFront();
    this._updateMinDimensions();
    this._updateMaxDimensions();

    this.element.style.transition = 'none';
    this.element.classList.remove(...this.hideClasses);
    this.element.classList.add(...this.showClasses);
    void this.element.offsetHeight;

    const rectBeforeCompensation = this.element.getBoundingClientRect();
    const parentRect = this.boundaryContainerElement.getBoundingClientRect();
    const visualLeftRelParent = rectBeforeCompensation.left - parentRect.left;
    const visualTopRelParent = rectBeforeCompensation.top - parentRect.top;

    const compensatedPixelLeft = visualLeftRelParent + (rectBeforeCompensation.width / 2);
    const compensatedPixelTop = visualTopRelParent + (rectBeforeCompensation.height / 2);

    this.element.style.transform = 'none';
    this.element.style.left = `${compensatedPixelLeft}px`;
    this.element.style.top = `${compensatedPixelTop}px`;
    void this.element.offsetHeight;

    const evt = (event instanceof MouseEvent) ? event : event.touches[0];
    this.initialResizeMouseX = evt.clientX;
    this.initialResizeMouseY = evt.clientY;
    this.initialWindowWidth = this.element.offsetWidth;
    this.initialWindowHeight = this.element.offsetHeight;

    this.element.style.width = `${this.initialWindowWidth}px`;
    this.element.style.height = `${this.initialWindowHeight}px`;

    this.isResizing = true;
    this.element.style.willChange = 'width, height, left, top';

    document.addEventListener('mousemove', this._onResizeMove);
    document.addEventListener('touchmove', this._onResizeMove, { passive: false });
    document.addEventListener('mouseup', this._onResizeEnd);
    document.addEventListener('touchend', this._onResizeEnd);
  }

  private _onResizeMove = (event: MouseEvent | TouchEvent): void => {
    if (!this.isResizing) return;
    event.preventDefault();
    const evt = (event instanceof MouseEvent) ? event : event.touches[0];
    const currentMouseX = evt.clientX;
    const currentMouseY = evt.clientY;

    const deltaX = currentMouseX - this.initialResizeMouseX;
    const deltaY = currentMouseY - this.initialResizeMouseY;
    let newWidth = this.initialWindowWidth + deltaX;
    let newHeight = this.initialWindowHeight + deltaY;

    newWidth = Math.max(this.minWidth, Math.min(newWidth, this.maxWidth));
    newHeight = Math.max(this.minHeight, Math.min(newHeight, this.maxHeight));
    
    const parentRect = this.boundaryContainerElement.getBoundingClientRect();
    const currentCssOriginLeft = parseFloat(this.element.style.left || '0');
    const currentCssOriginTop = parseFloat(this.element.style.top || '0');

    const visualCurrentLeft = currentCssOriginLeft - (this.element.offsetWidth / 2);
    const visualCurrentTop = currentCssOriginTop - (this.element.offsetHeight / 2);

    if (parentRect.width > 0 && (visualCurrentLeft + newWidth > parentRect.width)) {
      newWidth = parentRect.width - visualCurrentLeft;
    }
    if (parentRect.height > 0 && (visualCurrentTop + newHeight > parentRect.height)) {
      newHeight = parentRect.height - visualCurrentTop;
    }

    newWidth = Math.max(this.minWidth, Math.min(newWidth, this.maxWidth));
    newHeight = Math.max(this.minHeight, Math.min(newHeight, this.maxHeight));

    this.element.style.width = `${newWidth}px`;
    this.element.style.height = `${newHeight}px`;
  }

  private _onResizeEnd = (): void => {
    if (!this.isResizing) return;
    this.isResizing = false;
    this.element.style.willChange = 'auto';

    const finalRectPxView = this.element.getBoundingClientRect();
    const parentRect = this.boundaryContainerElement.getBoundingClientRect();
    let finalVisualPixelLeftRelParent = finalRectPxView.left - parentRect.left;
    let finalVisualPixelTopRelParent = finalRectPxView.top - parentRect.top;

    const windowWidth = this.element.offsetWidth;
    const windowHeight = this.element.offsetHeight;
    const parentWidth = parentRect.width;
    const parentHeight = parentRect.height;

    let boundedVisualPixelLeft = finalVisualPixelLeftRelParent;
    let boundedVisualPixelTop = finalVisualPixelTopRelParent;

    if (boundedVisualPixelLeft < 0) boundedVisualPixelLeft = 0;
    if (boundedVisualPixelTop < 0) boundedVisualPixelTop = 0;
    if (windowWidth >= parentWidth && parentWidth > 0) {
        boundedVisualPixelLeft = 0;
    } else if (boundedVisualPixelLeft + windowWidth > parentWidth && parentWidth > 0) {
        boundedVisualPixelLeft = parentWidth - windowWidth;
    }
    if (windowHeight >= parentHeight && parentHeight > 0) {
        boundedVisualPixelTop = 0;
    } else if (boundedVisualPixelTop + windowHeight > parentHeight && parentHeight > 0) {
        boundedVisualPixelTop = parentHeight - windowHeight;
    }
    boundedVisualPixelLeft = Math.max(0, boundedVisualPixelLeft);
    boundedVisualPixelTop = Math.max(0, boundedVisualPixelTop);

    let newStyleLeft, newStyleTop;
    if (parentWidth > 0 && parentHeight > 0) {
      const targetCssOriginLeftPx = boundedVisualPixelLeft + (windowWidth / 2);
      const targetCssOriginTopPx = boundedVisualPixelTop + (windowHeight / 2);
      const percentLeft = (targetCssOriginLeftPx / parentWidth) * 100;
      const percentTop = (targetCssOriginTopPx / parentHeight) * 100;
      newStyleLeft = `${percentLeft}%`;
      newStyleTop = `${percentTop}%`;
    } else {
      newStyleLeft = `${boundedVisualPixelLeft + (windowWidth / 2)}px`;
      newStyleTop = `${boundedVisualPixelTop + (windowHeight / 2)}px`;
    }

    this.element.style.transform = '';
    this.element.style.left = newStyleLeft;
    this.element.style.top = newStyleTop;
    void this.element.offsetHeight;
    this.element.style.transition = '';

    document.removeEventListener('mousemove', this._onResizeMove);
    document.removeEventListener('touchmove', this._onResizeMove);
    document.removeEventListener('mouseup', this._onResizeEnd);
    document.removeEventListener('touchend', this._onResizeEnd);
  }
}