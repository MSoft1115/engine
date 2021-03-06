import { DEBUG, EDITOR } from 'internal:constants';
import { MouseCallback, MouseInputEvent, MouseWheelCallback, MouseWheelInputEvent } from 'pal/input';
import { system } from 'pal/system';
import { EventTarget } from '../../../cocos/core/event/event-target';
import { Rect, Vec2 } from '../../../cocos/core/math';
import { SystemEventType } from '../../../cocos/core/platform/event-manager/event-enum';

type MouseEventNames = 'mousedown' | 'mouseup' | 'mousemove' | 'wheel';

export class MouseInputSource {
    public support: boolean;
    private _canvas?: HTMLCanvasElement;
    private _eventTarget: EventTarget = new EventTarget();
    private _pointLocked = false;
    private _isPressed = false;

    constructor () {
        this.support = !system.isMobile && !EDITOR;
        if (this.support) {
            this._canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
            if (!this._canvas && DEBUG) {
                console.warn('failed to access canvas');
            }
            this._registerEvent();
        }
    }

    private _getCanvasRect (): Rect {
        const canvas = this._canvas;
        const box = canvas?.getBoundingClientRect();
        if (box) {
            return new Rect(box.x, box.y, box.width, box.height);
        }
        return new Rect(0, 0, 0, 0);
    }

    private _getLocation (event: MouseEvent): Vec2 {
        return new Vec2(event.clientX, event.clientY);
    }

    private _registerEvent () {
        this._registerEventOnWindowAndCanvas('mousedown', this._createCallback(SystemEventType.MOUSE_DOWN));
        this._registerEventOnWindowAndCanvas('mousemove', this._createCallback(SystemEventType.MOUSE_MOVE));
        this._registerEventOnWindowAndCanvas('mouseup', this._createCallback(SystemEventType.MOUSE_UP));
        // register wheel event
        this._canvas?.addEventListener('wheel', (event: WheelEvent) => {
            const canvasRect = this._getCanvasRect();
            const location = this._getLocation(event);
            const wheelSensitivityFactor = 5;
            const inputEvent: MouseWheelInputEvent = {
                type: SystemEventType.MOUSE_WHEEL,
                x: location.x - canvasRect.x,
                y: canvasRect.y + canvasRect.height - location.y,
                button: event.button,  // TODO: what is the button when tracking mouse move ?
                deltaX: event.deltaX * wheelSensitivityFactor,
                deltaY: -event.deltaY * wheelSensitivityFactor,
                timestamp: performance.now(),
                movementX: event.movementX,
                movementY: event.movementY,
            };
            event.stopPropagation();
            event.preventDefault();
            this._eventTarget.emit(SystemEventType.MOUSE_WHEEL, inputEvent);
        });
        this._registerPointerLockEvent();
    }

    private _registerEventOnWindowAndCanvas (eventName: MouseEventNames, eventCb: (event: MouseEvent) => void) {
        window.addEventListener(eventName, eventCb);
        this._canvas?.addEventListener(eventName,  eventCb);
    }

    // To be removed in the future.
    private _registerPointerLockEvent () {
        const lockChangeAlert = () => {
            const canvas = this._canvas;
            // @ts-expect-error undefined mozPointerLockElement
            if (document.pointerLockElement === canvas || document.mozPointerLockElement === canvas) {
                this._pointLocked = true;
            } else {
                this._pointLocked = false;
            }
        };
        if ('onpointerlockchange' in document) {
            document.addEventListener('pointerlockchange', lockChangeAlert, false);
        } else if ('onmozpointerlockchange' in document) {
            // @ts-expect-error undefined mozpointerlockchange event
            document.addEventListener('mozpointerlockchange', lockChangeAlert, false);
        }
    }

    private _createCallback (eventType: string) {
        return (event: MouseEvent) => {
            const canvasRect = this._getCanvasRect();
            const location = this._getLocation(event);
            let button = event.button;
            switch (event.type) {
            case 'mousedown':
                this._canvas?.focus();
                this._isPressed = true;
                break;
            case 'mouseup':
                this._isPressed = false;
                break;
            case 'mousemove':
                if (!this._isPressed) {
                    button = -1;  // TODO: should not access EventMouse.BUTTON_MISSING, need a button enum type
                }
                break;
            default:
                break;
            }
            const inputEvent: MouseInputEvent = {
                type: eventType,
                x: location.x - canvasRect.x + (this._pointLocked ? event.movementX : 0),
                y: canvasRect.y + canvasRect.height - location.y - (this._pointLocked ? event.movementY : 0),
                button,
                timestamp: performance.now(),
                // this is web only property
                movementX: event.movementX,
                movementY: event.movementY,
            };
            event.stopPropagation();
            if (event.target === this._canvas) {
                event.preventDefault();
            }
            // emit web mouse event
            this._eventTarget.emit(eventType, inputEvent);
        };
    }

    onDown (cb: MouseCallback) {
        this._eventTarget.on(SystemEventType.MOUSE_DOWN, cb);
    }
    onMove (cb: MouseCallback) {
        this._eventTarget.on(SystemEventType.MOUSE_MOVE, cb);
    }
    onUp (cb: MouseCallback) {
        this._eventTarget.on(SystemEventType.MOUSE_UP, cb);
    }
    onWheel (cb: MouseWheelCallback) {
        this._eventTarget.on(SystemEventType.MOUSE_WHEEL, cb);
    }
}
