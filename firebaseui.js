(function() {
    (function() {
        var supportCustomEvent = window.CustomEvent;
        if (!supportCustomEvent || typeof supportCustomEvent === "object") {
            supportCustomEvent = function CustomEvent(event, x) {
                x = x || {};
                var ev = document.createEvent("CustomEvent");
                ev.initCustomEvent(event, !!x.bubbles, !!x.cancelable, x.detail || null);
                return ev
            };
            supportCustomEvent.prototype = window.Event.prototype
        }

        function createsStackingContext(el) {
            while (el && el !== document.body) {
                var s = window.getComputedStyle(el);
                var invalid = function(k, ok) {
                    return !(s[k] === undefined || s[k] ===
                        ok)
                };
                if (s.opacity < 1 || invalid("zIndex", "auto") || invalid("transform", "none") || invalid("mixBlendMode", "normal") || invalid("filter", "none") || invalid("perspective", "none") || s["isolation"] === "isolate" || s.position === "fixed" || s.webkitOverflowScrolling === "touch") return true;
                el = el.parentElement
            }
            return false
        }

        function findNearestDialog(el) {
            while (el) {
                if (el.localName === "dialog") return el;
                el = el.parentElement
            }
            return null
        }

        function safeBlur(el) {
            if (el && el.blur && el !== document.body) el.blur()
        }

        function inNodeList(nodeList,
            node) {
            for (var i = 0; i < nodeList.length; ++i)
                if (nodeList[i] === node) return true;
            return false
        }

        function isFormMethodDialog(el) {
            if (!el || !el.hasAttribute("method")) return false;
            return el.getAttribute("method").toLowerCase() === "dialog"
        }

        function dialogPolyfillInfo(dialog) {
            this.dialog_ = dialog;
            this.replacedStyleTop_ = false;
            this.openAsModal_ = false;
            if (!dialog.hasAttribute("role")) dialog.setAttribute("role", "dialog");
            dialog.show = this.show.bind(this);
            dialog.showModal = this.showModal.bind(this);
            dialog.close = this.close.bind(this);
            if (!("returnValue" in dialog)) dialog.returnValue = "";
            if ("MutationObserver" in window) {
                var mo = new MutationObserver(this.maybeHideModal.bind(this));
                mo.observe(dialog, {
                    attributes: true,
                    attributeFilter: ["open"]
                })
            } else {
                var removed = false;
                var cb = function() {
                    removed ? this.downgradeModal() : this.maybeHideModal();
                    removed = false
                }.bind(this);
                var timeout;
                var delayModel = function(ev) {
                    if (ev.target !== dialog) return;
                    var cand = "DOMNodeRemoved";
                    removed |= ev.type.substr(0, cand.length) === cand;
                    window.clearTimeout(timeout);
                    timeout =
                        window.setTimeout(cb, 0)
                };
                ["DOMAttrModified", "DOMNodeRemoved", "DOMNodeRemovedFromDocument"].forEach(function(name) {
                    dialog.addEventListener(name, delayModel)
                })
            }
            Object.defineProperty(dialog, "open", {
                set: this.setOpen.bind(this),
                get: dialog.hasAttribute.bind(dialog, "open")
            });
            this.backdrop_ = document.createElement("div");
            this.backdrop_.className = "backdrop";
            this.backdrop_.addEventListener("click", this.backdropClick_.bind(this))
        }
        dialogPolyfillInfo.prototype = {
            get dialog() {
                return this.dialog_
            },
            maybeHideModal: function() {
                if (this.dialog_.hasAttribute("open") &&
                    document.body.contains(this.dialog_)) return;
                this.downgradeModal()
            },
            downgradeModal: function() {
                if (!this.openAsModal_) return;
                this.openAsModal_ = false;
                this.dialog_.style.zIndex = "";
                if (this.replacedStyleTop_) {
                    this.dialog_.style.top = "";
                    this.replacedStyleTop_ = false
                }
                this.backdrop_.parentNode && this.backdrop_.parentNode.removeChild(this.backdrop_);
                dialogPolyfill.dm.removeDialog(this)
            },
            setOpen: function(value) {
                if (value) this.dialog_.hasAttribute("open") || this.dialog_.setAttribute("open", "");
                else {
                    this.dialog_.removeAttribute("open");
                    this.maybeHideModal()
                }
            },
            backdropClick_: function(e) {
                if (!this.dialog_.hasAttribute("tabindex")) {
                    var fake = document.createElement("div");
                    this.dialog_.insertBefore(fake, this.dialog_.firstChild);
                    fake.tabIndex = -1;
                    fake.focus();
                    this.dialog_.removeChild(fake)
                } else this.dialog_.focus();
                var redirectedEvent = document.createEvent("MouseEvents");
                redirectedEvent.initMouseEvent(e.type, e.bubbles, e.cancelable, window, e.detail, e.screenX, e.screenY, e.clientX, e.clientY, e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, e.button, e.relatedTarget);
                this.dialog_.dispatchEvent(redirectedEvent);
                e.stopPropagation()
            },
            focus_: function() {
                var target = this.dialog_.querySelector("[autofocus]:not([disabled])");
                if (!target && this.dialog_.tabIndex >= 0) target = this.dialog_;
                if (!target) {
                    var opts = ["button", "input", "keygen", "select", "textarea"];
                    var query = opts.map(function(el) {
                        return el + ":not([disabled])"
                    });
                    query.push('[tabindex]:not([disabled]):not([tabindex=""])');
                    target = this.dialog_.querySelector(query.join(", "))
                }
                safeBlur(document.activeElement);
                target && target.focus()
            },
            updateZIndex: function(dialogZ, backdropZ) {
                if (dialogZ < backdropZ) throw new Error("dialogZ should never be < backdropZ");
                this.dialog_.style.zIndex = dialogZ;
                this.backdrop_.style.zIndex = backdropZ
            },
            show: function() {
                if (!this.dialog_.open) {
                    this.setOpen(true);
                    this.focus_()
                }
            },
            showModal: function() {
                if (this.dialog_.hasAttribute("open")) throw new Error("Failed to execute 'showModal' on dialog: The element is already open, and therefore cannot be opened modally.");
                if (!document.body.contains(this.dialog_)) throw new Error("Failed to execute 'showModal' on dialog: The element is not in a Document.");
                if (!dialogPolyfill.dm.pushDialog(this)) throw new Error("Failed to execute 'showModal' on dialog: There are too many open modal dialogs.");
                if (createsStackingContext(this.dialog_.parentElement)) console.warn("A dialog is being shown inside a stacking context. " + "This may cause it to be unusable. For more information, see this link: " + "https://github.com/GoogleChrome/dialog-polyfill/#stacking-context");
                this.setOpen(true);
                this.openAsModal_ = true;
                if (dialogPolyfill.needsCentering(this.dialog_)) {
                    dialogPolyfill.reposition(this.dialog_);
                    this.replacedStyleTop_ = true
                } else this.replacedStyleTop_ = false;
                this.dialog_.parentNode.insertBefore(this.backdrop_, this.dialog_.nextSibling);
                this.focus_()
            },
            close: function(opt_returnValue) {
                if (!this.dialog_.hasAttribute("open")) throw new Error("Failed to execute 'close' on dialog: The element does not have an 'open' attribute, and therefore cannot be closed.");
                this.setOpen(false);
                if (opt_returnValue !== undefined) this.dialog_.returnValue = opt_returnValue;
                var closeEvent = new supportCustomEvent("close", {
                    bubbles: false,
                    cancelable: false
                });
                this.dialog_.dispatchEvent(closeEvent)
            }
        };
        var dialogPolyfill = {};
        dialogPolyfill.reposition = function(element) {
            var scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
            var topValue = scrollTop + (window.innerHeight - element.offsetHeight) / 2;
            element.style.top = Math.max(scrollTop, topValue) + "px"
        };
        dialogPolyfill.isInlinePositionSetByStylesheet = function(element) {
            for (var i = 0; i < document.styleSheets.length; ++i) {
                var styleSheet = document.styleSheets[i];
                var cssRules = null;
                try {
                    cssRules =
                        styleSheet.cssRules
                } catch (e) {}
                if (!cssRules) continue;
                for (var j = 0; j < cssRules.length; ++j) {
                    var rule = cssRules[j];
                    var selectedNodes = null;
                    try {
                        selectedNodes = document.querySelectorAll(rule.selectorText)
                    } catch (e$0) {}
                    if (!selectedNodes || !inNodeList(selectedNodes, element)) continue;
                    var cssTop = rule.style.getPropertyValue("top");
                    var cssBottom = rule.style.getPropertyValue("bottom");
                    if (cssTop && cssTop !== "auto" || cssBottom && cssBottom !== "auto") return true
                }
            }
            return false
        };
        dialogPolyfill.needsCentering = function(dialog) {
            var computedStyle =
                window.getComputedStyle(dialog);
            if (computedStyle.position !== "absolute") return false;
            if (dialog.style.top !== "auto" && dialog.style.top !== "" || dialog.style.bottom !== "auto" && dialog.style.bottom !== "") return false;
            return !dialogPolyfill.isInlinePositionSetByStylesheet(dialog)
        };
        dialogPolyfill.forceRegisterDialog = function(element) {
            if (window.HTMLDialogElement || element.showModal) console.warn("This browser already supports <dialog>, the polyfill " + "may not work correctly", element);
            if (element.localName !== "dialog") throw new Error("Failed to register dialog: The element is not a dialog.");
            new dialogPolyfillInfo(element)
        };
        dialogPolyfill.registerDialog = function(element) {
            if (!element.showModal) dialogPolyfill.forceRegisterDialog(element)
        };
        dialogPolyfill.DialogManager = function() {
            this.pendingDialogStack = [];
            var checkDOM = this.checkDOM_.bind(this);
            this.overlay = document.createElement("div");
            this.overlay.className = "_dialog_overlay";
            this.overlay.addEventListener("click", function(e) {
                this.forwardTab_ = undefined;
                e.stopPropagation();
                checkDOM([])
            }.bind(this));
            this.handleKey_ = this.handleKey_.bind(this);
            this.handleFocus_ = this.handleFocus_.bind(this);
            this.zIndexLow_ = 1E5;
            this.zIndexHigh_ = 1E5 + 150;
            this.forwardTab_ = undefined;
            if ("MutationObserver" in window) this.mo_ = new MutationObserver(function(records) {
                var removed = [];
                records.forEach(function(rec) {
                    for (var i = 0, c; c = rec.removedNodes[i]; ++i) {
                        if (!(c instanceof Element)) continue;
                        else if (c.localName === "dialog") removed.push(c);
                        removed = removed.concat(c.querySelectorAll("dialog"))
                    }
                });
                removed.length && checkDOM(removed)
            })
        };
        dialogPolyfill.DialogManager.prototype.blockDocument =
            function() {
                document.documentElement.addEventListener("focus", this.handleFocus_, true);
                document.addEventListener("keydown", this.handleKey_);
                this.mo_ && this.mo_.observe(document, {
                    childList: true,
                    subtree: true
                })
            };
        dialogPolyfill.DialogManager.prototype.unblockDocument = function() {
            document.documentElement.removeEventListener("focus", this.handleFocus_, true);
            document.removeEventListener("keydown", this.handleKey_);
            this.mo_ && this.mo_.disconnect()
        };
        dialogPolyfill.DialogManager.prototype.updateStacking = function() {
            var zIndex =
                this.zIndexHigh_;
            for (var i = 0, dpi; dpi = this.pendingDialogStack[i]; ++i) {
                dpi.updateZIndex(--zIndex, --zIndex);
                if (i === 0) this.overlay.style.zIndex = --zIndex
            }
            var last = this.pendingDialogStack[0];
            if (last) {
                var p = last.dialog.parentNode || document.body;
                p.appendChild(this.overlay)
            } else if (this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay)
        };
        dialogPolyfill.DialogManager.prototype.containedByTopDialog_ = function(candidate) {
            while (candidate = findNearestDialog(candidate)) {
                for (var i = 0, dpi; dpi = this.pendingDialogStack[i]; ++i)
                    if (dpi.dialog ===
                        candidate) return i === 0;
                candidate = candidate.parentElement
            }
            return false
        };
        dialogPolyfill.DialogManager.prototype.handleFocus_ = function(event) {
            if (this.containedByTopDialog_(event.target)) return;
            event.preventDefault();
            event.stopPropagation();
            safeBlur(event.target);
            if (this.forwardTab_ === undefined) return;
            var dpi = this.pendingDialogStack[0];
            var dialog = dpi.dialog;
            var position = dialog.compareDocumentPosition(event.target);
            if (position & Node.DOCUMENT_POSITION_PRECEDING)
                if (this.forwardTab_) dpi.focus_();
                else document.documentElement.focus();
            else;
            return false
        };
        dialogPolyfill.DialogManager.prototype.handleKey_ = function(event) {
            this.forwardTab_ = undefined;
            if (event.keyCode === 27) {
                event.preventDefault();
                event.stopPropagation();
                var cancelEvent = new supportCustomEvent("cancel", {
                    bubbles: false,
                    cancelable: true
                });
                var dpi = this.pendingDialogStack[0];
                if (dpi && dpi.dialog.dispatchEvent(cancelEvent)) dpi.dialog.close()
            } else if (event.keyCode === 9) this.forwardTab_ = !event.shiftKey
        };
        dialogPolyfill.DialogManager.prototype.checkDOM_ = function(removed) {
            var clone = this.pendingDialogStack.slice();
            clone.forEach(function(dpi) {
                if (removed.indexOf(dpi.dialog) !== -1) dpi.downgradeModal();
                else dpi.maybeHideModal()
            })
        };
        dialogPolyfill.DialogManager.prototype.pushDialog = function(dpi) {
            var allowed = (this.zIndexHigh_ - this.zIndexLow_) / 2 - 1;
            if (this.pendingDialogStack.length >= allowed) return false;
            if (this.pendingDialogStack.unshift(dpi) === 1) this.blockDocument();
            this.updateStacking();
            return true
        };
        dialogPolyfill.DialogManager.prototype.removeDialog = function(dpi) {
            var index = this.pendingDialogStack.indexOf(dpi);
            if (index ===
                -1) return;
            this.pendingDialogStack.splice(index, 1);
            if (this.pendingDialogStack.length === 0) this.unblockDocument();
            this.updateStacking()
        };
        dialogPolyfill.dm = new dialogPolyfill.DialogManager;
        dialogPolyfill.formSubmitter = null;
        dialogPolyfill.useValue = null;
        if (window.HTMLDialogElement === undefined) {
            var testForm = document.createElement("form");
            testForm.setAttribute("method", "dialog");
            if (testForm.method !== "dialog") {
                var methodDescriptor = Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, "method");
                if (methodDescriptor) {
                    var realGet =
                        methodDescriptor.get;
                    methodDescriptor.get = function() {
                        if (isFormMethodDialog(this)) return "dialog";
                        return realGet.call(this)
                    };
                    var realSet = methodDescriptor.set;
                    methodDescriptor.set = function(v) {
                        if (typeof v === "string" && v.toLowerCase() === "dialog") return this.setAttribute("method", v);
                        return realSet.call(this, v)
                    };
                    Object.defineProperty(HTMLFormElement.prototype, "method", methodDescriptor)
                }
            }
            document.addEventListener("click", function(ev) {
                dialogPolyfill.formSubmitter = null;
                dialogPolyfill.useValue = null;
                if (ev.defaultPrevented) return;
                var target = ev.target;
                if (!target || !isFormMethodDialog(target.form)) return;
                var valid = target.type === "submit" && ["button", "input"].indexOf(target.localName) > -1;
                if (!valid) {
                    if (!(target.localName === "input" && target.type === "image")) return;
                    dialogPolyfill.useValue = ev.offsetX + "," + ev.offsetY
                }
                var dialog = findNearestDialog(target);
                if (!dialog) return;
                dialogPolyfill.formSubmitter = target
            }, false);
            var nativeFormSubmit = HTMLFormElement.prototype.submit;
            var replacementFormSubmit = function() {
                if (!isFormMethodDialog(this)) return nativeFormSubmit.call(this);
                var dialog = findNearestDialog(this);
                dialog && dialog.close()
            };
            HTMLFormElement.prototype.submit = replacementFormSubmit;
            document.addEventListener("submit", function(ev) {
                var form = ev.target;
                if (!isFormMethodDialog(form)) return;
                ev.preventDefault();
                var dialog = findNearestDialog(form);
                if (!dialog) return;
                var s = dialogPolyfill.formSubmitter;
                if (s && s.form === form) dialog.close(dialogPolyfill.useValue || s.value);
                else dialog.close();
                dialogPolyfill.formSubmitter = null
            }, true)
        }
        dialogPolyfill["forceRegisterDialog"] = dialogPolyfill.forceRegisterDialog;
        dialogPolyfill["registerDialog"] = dialogPolyfill.registerDialog;
        if (typeof define === "function" && "amd" in define) define(function() {
            return dialogPolyfill
        });
        else if (typeof module === "object" && typeof module["exports"] === "object") module["exports"] = dialogPolyfill;
        else window["dialogPolyfill"] = dialogPolyfill
    })();
    var componentHandler = {
        upgradeDom: function(optJsClass, optCssClass) {},
        upgradeElement: function(element, optJsClass) {},
        upgradeElements: function(elements) {},
        upgradeAllRegistered: function() {},
        registerUpgradedCallback: function(jsClass, callback) {},
        register: function(config) {},
        downgradeElements: function(nodes) {}
    };
    componentHandler = function() {
        var registeredComponents_ = [];
        var createdComponents_ = [];
        var componentConfigProperty_ = "mdlComponentConfigInternal_";

        function findRegisteredClass_(name, optReplace) {
            for (var i = 0; i < registeredComponents_.length; i++)
                if (registeredComponents_[i].className === name) {
                    if (typeof optReplace !== "undefined") registeredComponents_[i] = optReplace;
                    return registeredComponents_[i]
                } return false
        }

        function getUpgradedListOfElement_(element) {
            var dataUpgraded = element.getAttribute("data-upgraded");
            return dataUpgraded ===
                null ? [""] : dataUpgraded.split(",")
        }

        function isElementUpgraded_(element, jsClass) {
            var upgradedList = getUpgradedListOfElement_(element);
            return upgradedList.indexOf(jsClass) !== -1
        }

        function createEvent_(eventType, bubbles, cancelable) {
            if ("CustomEvent" in window && typeof window.CustomEvent === "function") return new CustomEvent(eventType, {
                bubbles: bubbles,
                cancelable: cancelable
            });
            else {
                var ev = document.createEvent("Events");
                ev.initEvent(eventType, bubbles, cancelable);
                return ev
            }
        }

        function upgradeDomInternal(optJsClass,
            optCssClass) {
            if (typeof optJsClass === "undefined" && typeof optCssClass === "undefined")
                for (var i = 0; i < registeredComponents_.length; i++) upgradeDomInternal(registeredComponents_[i].className, registeredComponents_[i].cssClass);
            else {
                var jsClass = optJsClass;
                if (typeof optCssClass === "undefined") {
                    var registeredClass = findRegisteredClass_(jsClass);
                    if (registeredClass) optCssClass = registeredClass.cssClass
                }
                var elements = document.querySelectorAll("." + optCssClass);
                for (var n = 0; n < elements.length; n++) upgradeElementInternal(elements[n],
                    jsClass)
            }
        }

        function upgradeElementInternal(element, optJsClass) {
            if (!(typeof element === "object" && element instanceof Element)) throw new Error("Invalid argument provided to upgrade MDL element.");
            var upgradingEv = createEvent_("mdl-componentupgrading", true, true);
            element.dispatchEvent(upgradingEv);
            if (upgradingEv.defaultPrevented) return;
            var upgradedList = getUpgradedListOfElement_(element);
            var classesToUpgrade = [];
            if (!optJsClass) {
                var classList = element.classList;
                registeredComponents_.forEach(function(component) {
                    if (classList.contains(component.cssClass) &&
                        classesToUpgrade.indexOf(component) === -1 && !isElementUpgraded_(element, component.className)) classesToUpgrade.push(component)
                })
            } else if (!isElementUpgraded_(element, optJsClass)) classesToUpgrade.push(findRegisteredClass_(optJsClass));
            for (var i = 0, n = classesToUpgrade.length, registeredClass; i < n; i++) {
                registeredClass = classesToUpgrade[i];
                if (registeredClass) {
                    upgradedList.push(registeredClass.className);
                    element.setAttribute("data-upgraded", upgradedList.join(","));
                    var instance = new registeredClass.classConstructor(element);
                    instance[componentConfigProperty_] = registeredClass;
                    createdComponents_.push(instance);
                    for (var j = 0, m = registeredClass.callbacks.length; j < m; j++) registeredClass.callbacks[j](element);
                    if (registeredClass.widget) element[registeredClass.className] = instance
                } else throw new Error("Unable to find a registered component for the given class.");
                var upgradedEv = createEvent_("mdl-componentupgraded", true, false);
                element.dispatchEvent(upgradedEv)
            }
        }

        function upgradeElementsInternal(elements) {
            if (!Array.isArray(elements))
                if (elements instanceof Element) elements = [elements];
                else elements = Array.prototype.slice.call(elements);
            for (var i = 0, n = elements.length, element; i < n; i++) {
                element = elements[i];
                if (element instanceof HTMLElement) {
                    upgradeElementInternal(element);
                    if (element.children.length > 0) upgradeElementsInternal(element.children)
                }
            }
        }

        function registerInternal(config) {
            var widgetMissing = typeof config.widget === "undefined" && typeof config["widget"] === "undefined";
            var widget = true;
            if (!widgetMissing) widget = config.widget || config["widget"];
            var newConfig = {
                classConstructor: config.constructor ||
                    config["constructor"],
                className: config.classAsString || config["classAsString"],
                cssClass: config.cssClass || config["cssClass"],
                widget: widget,
                callbacks: []
            };
            registeredComponents_.forEach(function(item) {
                if (item.cssClass === newConfig.cssClass) throw new Error("The provided cssClass has already been registered: " + item.cssClass);
                if (item.className === newConfig.className) throw new Error("The provided className has already been registered");
            });
            if (config.constructor.prototype.hasOwnProperty(componentConfigProperty_)) throw new Error("MDL component classes must not have " +
                componentConfigProperty_ + " defined as a property.");
            var found = findRegisteredClass_(config.classAsString, newConfig);
            if (!found) registeredComponents_.push(newConfig)
        }

        function registerUpgradedCallbackInternal(jsClass, callback) {
            var regClass = findRegisteredClass_(jsClass);
            if (regClass) regClass.callbacks.push(callback)
        }

        function upgradeAllRegisteredInternal() {
            for (var n = 0; n < registeredComponents_.length; n++) upgradeDomInternal(registeredComponents_[n].className)
        }

        function deconstructComponentInternal(component) {
            if (component) {
                var componentIndex =
                    createdComponents_.indexOf(component);
                createdComponents_.splice(componentIndex, 1);
                var upgrades = component.element_.getAttribute("data-upgraded").split(",");
                var componentPlace = upgrades.indexOf(component[componentConfigProperty_].classAsString);
                upgrades.splice(componentPlace, 1);
                component.element_.setAttribute("data-upgraded", upgrades.join(","));
                var ev = createEvent_("mdl-componentdowngraded", true, false);
                component.element_.dispatchEvent(ev)
            }
        }

        function downgradeNodesInternal(nodes) {
            var downgradeNode = function(node) {
                createdComponents_.filter(function(item) {
                    return item.element_ ===
                        node
                }).forEach(deconstructComponentInternal)
            };
            if (nodes instanceof Array || nodes instanceof NodeList)
                for (var n = 0; n < nodes.length; n++) downgradeNode(nodes[n]);
            else if (nodes instanceof Node) downgradeNode(nodes);
            else throw new Error("Invalid argument provided to downgrade MDL nodes.");
        }
        return {
            upgradeDom: upgradeDomInternal,
            upgradeElement: upgradeElementInternal,
            upgradeElements: upgradeElementsInternal,
            upgradeAllRegistered: upgradeAllRegisteredInternal,
            registerUpgradedCallback: registerUpgradedCallbackInternal,
            register: registerInternal,
            downgradeElements: downgradeNodesInternal
        }
    }();
    componentHandler.ComponentConfigPublic;
    componentHandler.ComponentConfig;
    componentHandler.Component;
    componentHandler["upgradeDom"] = componentHandler.upgradeDom;
    componentHandler["upgradeElement"] = componentHandler.upgradeElement;
    componentHandler["upgradeElements"] = componentHandler.upgradeElements;
    componentHandler["upgradeAllRegistered"] = componentHandler.upgradeAllRegistered;
    componentHandler["registerUpgradedCallback"] = componentHandler.registerUpgradedCallback;
    componentHandler["register"] = componentHandler.register;
    componentHandler["downgradeElements"] = componentHandler.downgradeElements;
    window.componentHandler = componentHandler;
    window["componentHandler"] = componentHandler;
    window.addEventListener("load", function() {
        if ("classList" in document.createElement("div") && "querySelector" in document && "addEventListener" in window && Array.prototype.forEach) {
            document.documentElement.classList.add("mdl-js");
            componentHandler.upgradeAllRegistered()
        } else {
            componentHandler.upgradeElement = function() {};
            componentHandler.register = function() {}
        }
    });
    (function() {
        var MaterialButton = function MaterialButton(element) {
            this.element_ = element;
            this.init()
        };
        window["MaterialButton"] = MaterialButton;
        MaterialButton.prototype.Constant_ = {};
        MaterialButton.prototype.CssClasses_ = {
            RIPPLE_EFFECT: "mdl-js-ripple-effect",
            RIPPLE_CONTAINER: "mdl-button__ripple-container",
            RIPPLE: "mdl-ripple"
        };
        MaterialButton.prototype.blurHandler_ = function(event) {
            if (event) this.element_.blur()
        };
        MaterialButton.prototype.disable = function() {
            this.element_.disabled = true
        };
        MaterialButton.prototype["disable"] =
            MaterialButton.prototype.disable;
        MaterialButton.prototype.enable = function() {
            this.element_.disabled = false
        };
        MaterialButton.prototype["enable"] = MaterialButton.prototype.enable;
        MaterialButton.prototype.init = function() {
            if (this.element_) {
                if (this.element_.classList.contains(this.CssClasses_.RIPPLE_EFFECT)) {
                    var rippleContainer = document.createElement("span");
                    rippleContainer.classList.add(this.CssClasses_.RIPPLE_CONTAINER);
                    this.rippleElement_ = document.createElement("span");
                    this.rippleElement_.classList.add(this.CssClasses_.RIPPLE);
                    rippleContainer.appendChild(this.rippleElement_);
                    this.boundRippleBlurHandler = this.blurHandler_.bind(this);
                    this.rippleElement_.addEventListener("mouseup", this.boundRippleBlurHandler);
                    this.element_.appendChild(rippleContainer)
                }
                this.boundButtonBlurHandler = this.blurHandler_.bind(this);
                this.element_.addEventListener("mouseup", this.boundButtonBlurHandler);
                this.element_.addEventListener("mouseleave", this.boundButtonBlurHandler)
            }
        };
        componentHandler.register({
            constructor: MaterialButton,
            classAsString: "MaterialButton",
            cssClass: "mdl-js-button",
            widget: true
        })
    })();
    (function() {
        var MaterialProgress = function MaterialProgress(element) {
            this.element_ = element;
            this.init()
        };
        window["MaterialProgress"] = MaterialProgress;
        MaterialProgress.prototype.Constant_ = {};
        MaterialProgress.prototype.CssClasses_ = {
            INDETERMINATE_CLASS: "mdl-progress__indeterminate"
        };
        MaterialProgress.prototype.setProgress = function(p) {
            if (this.element_.classList.contains(this.CssClasses_.INDETERMINATE_CLASS)) return;
            this.progressbar_.style.width = p + "%"
        };
        MaterialProgress.prototype["setProgress"] = MaterialProgress.prototype.setProgress;
        MaterialProgress.prototype.setBuffer = function(p) {
            this.bufferbar_.style.width = p + "%";
            this.auxbar_.style.width = 100 - p + "%"
        };
        MaterialProgress.prototype["setBuffer"] = MaterialProgress.prototype.setBuffer;
        MaterialProgress.prototype.init = function() {
            if (this.element_) {
                var el = document.createElement("div");
                el.className = "progressbar bar bar1";
                this.element_.appendChild(el);
                this.progressbar_ = el;
                el = document.createElement("div");
                el.className = "bufferbar bar bar2";
                this.element_.appendChild(el);
                this.bufferbar_ = el;
                el = document.createElement("div");
                el.className = "auxbar bar bar3";
                this.element_.appendChild(el);
                this.auxbar_ = el;
                this.progressbar_.style.width = "0%";
                this.bufferbar_.style.width = "100%";
                this.auxbar_.style.width = "0%";
                this.element_.classList.add("is-upgraded")
            }
        };
        componentHandler.register({
            constructor: MaterialProgress,
            classAsString: "MaterialProgress",
            cssClass: "mdl-js-progress",
            widget: true
        })
    })();
    (function() {
        var MaterialSpinner = function MaterialSpinner(element) {
            this.element_ = element;
            this.init()
        };
        window["MaterialSpinner"] = MaterialSpinner;
        MaterialSpinner.prototype.Constant_ = {
            MDL_SPINNER_LAYER_COUNT: 4
        };
        MaterialSpinner.prototype.CssClasses_ = {
            MDL_SPINNER_LAYER: "mdl-spinner__layer",
            MDL_SPINNER_CIRCLE_CLIPPER: "mdl-spinner__circle-clipper",
            MDL_SPINNER_CIRCLE: "mdl-spinner__circle",
            MDL_SPINNER_GAP_PATCH: "mdl-spinner__gap-patch",
            MDL_SPINNER_LEFT: "mdl-spinner__left",
            MDL_SPINNER_RIGHT: "mdl-spinner__right"
        };
        MaterialSpinner.prototype.createLayer = function(index) {
            var layer = document.createElement("div");
            layer.classList.add(this.CssClasses_.MDL_SPINNER_LAYER);
            layer.classList.add(this.CssClasses_.MDL_SPINNER_LAYER + "-" + index);
            var leftClipper = document.createElement("div");
            leftClipper.classList.add(this.CssClasses_.MDL_SPINNER_CIRCLE_CLIPPER);
            leftClipper.classList.add(this.CssClasses_.MDL_SPINNER_LEFT);
            var gapPatch = document.createElement("div");
            gapPatch.classList.add(this.CssClasses_.MDL_SPINNER_GAP_PATCH);
            var rightClipper =
                document.createElement("div");
            rightClipper.classList.add(this.CssClasses_.MDL_SPINNER_CIRCLE_CLIPPER);
            rightClipper.classList.add(this.CssClasses_.MDL_SPINNER_RIGHT);
            var circleOwners = [leftClipper, gapPatch, rightClipper];
            for (var i = 0; i < circleOwners.length; i++) {
                var circle = document.createElement("div");
                circle.classList.add(this.CssClasses_.MDL_SPINNER_CIRCLE);
                circleOwners[i].appendChild(circle)
            }
            layer.appendChild(leftClipper);
            layer.appendChild(gapPatch);
            layer.appendChild(rightClipper);
            this.element_.appendChild(layer)
        };
        MaterialSpinner.prototype["createLayer"] = MaterialSpinner.prototype.createLayer;
        MaterialSpinner.prototype.stop = function() {
            this.element_.classList.remove("is-active")
        };
        MaterialSpinner.prototype["stop"] = MaterialSpinner.prototype.stop;
        MaterialSpinner.prototype.start = function() {
            this.element_.classList.add("is-active")
        };
        MaterialSpinner.prototype["start"] = MaterialSpinner.prototype.start;
        MaterialSpinner.prototype.init = function() {
            if (this.element_) {
                for (var i = 1; i <= this.Constant_.MDL_SPINNER_LAYER_COUNT; i++) this.createLayer(i);
                this.element_.classList.add("is-upgraded")
            }
        };
        componentHandler.register({
            constructor: MaterialSpinner,
            classAsString: "MaterialSpinner",
            cssClass: "mdl-js-spinner",
            widget: true
        })
    })();
    (function() {
        var MaterialTextfield = function MaterialTextfield(element) {
            this.element_ = element;
            this.maxRows = this.Constant_.NO_MAX_ROWS;
            this.init()
        };
        window["MaterialTextfield"] = MaterialTextfield;
        MaterialTextfield.prototype.Constant_ = {
            NO_MAX_ROWS: -1,
            MAX_ROWS_ATTRIBUTE: "maxrows"
        };
        MaterialTextfield.prototype.CssClasses_ = {
            LABEL: "mdl-textfield__label",
            INPUT: "mdl-textfield__input",
            IS_DIRTY: "is-dirty",
            IS_FOCUSED: "is-focused",
            IS_DISABLED: "is-disabled",
            IS_INVALID: "is-invalid",
            IS_UPGRADED: "is-upgraded",
            HAS_PLACEHOLDER: "has-placeholder"
        };
        MaterialTextfield.prototype.onKeyDown_ = function(event) {
            var currentRowCount = event.target.value.split("\n").length;
            if (event.keyCode === 13)
                if (currentRowCount >= this.maxRows) event.preventDefault()
        };
        MaterialTextfield.prototype.onFocus_ = function(event) {
            this.element_.classList.add(this.CssClasses_.IS_FOCUSED)
        };
        MaterialTextfield.prototype.onBlur_ = function(event) {
            this.element_.classList.remove(this.CssClasses_.IS_FOCUSED)
        };
        MaterialTextfield.prototype.onReset_ = function(event) {
            this.updateClasses_()
        };
        MaterialTextfield.prototype.updateClasses_ =
            function() {
                this.checkDisabled();
                this.checkValidity();
                this.checkDirty();
                this.checkFocus()
            };
        MaterialTextfield.prototype.checkDisabled = function() {
            if (this.input_.disabled) this.element_.classList.add(this.CssClasses_.IS_DISABLED);
            else this.element_.classList.remove(this.CssClasses_.IS_DISABLED)
        };
        MaterialTextfield.prototype["checkDisabled"] = MaterialTextfield.prototype.checkDisabled;
        MaterialTextfield.prototype.checkFocus = function() {
            if (Boolean(this.element_.querySelector(":focus"))) this.element_.classList.add(this.CssClasses_.IS_FOCUSED);
            else this.element_.classList.remove(this.CssClasses_.IS_FOCUSED)
        };
        MaterialTextfield.prototype["checkFocus"] = MaterialTextfield.prototype.checkFocus;
        MaterialTextfield.prototype.checkValidity = function() {
            if (this.input_.validity)
                if (this.input_.validity.valid) this.element_.classList.remove(this.CssClasses_.IS_INVALID);
                else this.element_.classList.add(this.CssClasses_.IS_INVALID)
        };
        MaterialTextfield.prototype["checkValidity"] = MaterialTextfield.prototype.checkValidity;
        MaterialTextfield.prototype.checkDirty =
            function() {
                if (this.input_.value && this.input_.value.length > 0) this.element_.classList.add(this.CssClasses_.IS_DIRTY);
                else this.element_.classList.remove(this.CssClasses_.IS_DIRTY)
            };
        MaterialTextfield.prototype["checkDirty"] = MaterialTextfield.prototype.checkDirty;
        MaterialTextfield.prototype.disable = function() {
            this.input_.disabled = true;
            this.updateClasses_()
        };
        MaterialTextfield.prototype["disable"] = MaterialTextfield.prototype.disable;
        MaterialTextfield.prototype.enable = function() {
            this.input_.disabled = false;
            this.updateClasses_()
        };
        MaterialTextfield.prototype["enable"] = MaterialTextfield.prototype.enable;
        MaterialTextfield.prototype.change = function(value) {
            this.input_.value = value || "";
            this.updateClasses_()
        };
        MaterialTextfield.prototype["change"] = MaterialTextfield.prototype.change;
        MaterialTextfield.prototype.init = function() {
            if (this.element_) {
                this.label_ = this.element_.querySelector("." + this.CssClasses_.LABEL);
                this.input_ = this.element_.querySelector("." + this.CssClasses_.INPUT);
                if (this.input_) {
                    if (this.input_.hasAttribute(this.Constant_.MAX_ROWS_ATTRIBUTE)) {
                        this.maxRows =
                            parseInt(this.input_.getAttribute(this.Constant_.MAX_ROWS_ATTRIBUTE), 10);
                        if (isNaN(this.maxRows)) this.maxRows = this.Constant_.NO_MAX_ROWS
                    }
                    if (this.input_.hasAttribute("placeholder")) this.element_.classList.add(this.CssClasses_.HAS_PLACEHOLDER);
                    this.boundUpdateClassesHandler = this.updateClasses_.bind(this);
                    this.boundFocusHandler = this.onFocus_.bind(this);
                    this.boundBlurHandler = this.onBlur_.bind(this);
                    this.boundResetHandler = this.onReset_.bind(this);
                    this.input_.addEventListener("input", this.boundUpdateClassesHandler);
                    this.input_.addEventListener("focus", this.boundFocusHandler);
                    this.input_.addEventListener("blur", this.boundBlurHandler);
                    this.input_.addEventListener("reset", this.boundResetHandler);
                    if (this.maxRows !== this.Constant_.NO_MAX_ROWS) {
                        this.boundKeyDownHandler = this.onKeyDown_.bind(this);
                        this.input_.addEventListener("keydown", this.boundKeyDownHandler)
                    }
                    var invalid = this.element_.classList.contains(this.CssClasses_.IS_INVALID);
                    this.updateClasses_();
                    this.element_.classList.add(this.CssClasses_.IS_UPGRADED);
                    if (invalid) this.element_.classList.add(this.CssClasses_.IS_INVALID);
                    if (this.input_.hasAttribute("autofocus")) {
                        this.element_.focus();
                        this.checkFocus()
                    }
                }
            }
        };
        componentHandler.register({
            constructor: MaterialTextfield,
            classAsString: "MaterialTextfield",
            cssClass: "mdl-js-textfield",
            widget: true
        })
    })();
    (function() {
        var k, aa = "function" == typeof Object.create ? Object.create : function(a) {
                function b() {}
                b.prototype = a;
                return new b
            },
            ba;
        if ("function" == typeof Object.setPrototypeOf) ba = Object.setPrototypeOf;
        else {
            var ca;
            a: {
                var da = {
                        yb: !0
                    },
                    ea = {};
                try {
                    ea.__proto__ = da;
                    ca = ea.yb;
                    break a
                } catch (a) {}
                ca = !1
            }
            ba = ca ? function(a, b) {
                a.__proto__ = b;
                if (a.__proto__ !== b) throw new TypeError(a + " is not extensible");
                return a
            } : null
        }
        var fa = ba;

        function m(a, b) {
            a.prototype = aa(b.prototype);
            a.prototype.constructor = a;
            if (fa) fa(a, b);
            else
                for (var c in b)
                    if ("prototype" !=
                        c)
                        if (Object.defineProperties) {
                            var d = Object.getOwnPropertyDescriptor(b, c);
                            d && Object.defineProperty(a, c, d)
                        } else a[c] = b[c];
            a.L = b.prototype
        }
        var ha = "function" == typeof Object.defineProperties ? Object.defineProperty : function(a, b, c) {
                a != Array.prototype && a != Object.prototype && (a[b] = c.value)
            },
            ia = "undefined" != typeof window && window === this ? this : "undefined" != typeof global && null != global ? global : this;

        function ja(a, b) {
            if (b) {
                var c = ia;
                a = a.split(".");
                for (var d = 0; d < a.length - 1; d++) {
                    var e = a[d];
                    e in c || (c[e] = {});
                    c = c[e]
                }
                a = a[a.length -
                    1];
                d = c[a];
                b = b(d);
                b != d && null != b && ha(c, a, {
                    configurable: !0,
                    writable: !0,
                    value: b
                })
            }
        }
        ja("Object.is", function(a) {
            return a ? a : function(b, c) {
                return b === c ? 0 !== b || 1 / b === 1 / c : b !== b && c !== c
            }
        });
        ja("Array.prototype.includes", function(a) {
            return a ? a : function(b, c) {
                var d = this;
                d instanceof String && (d = String(d));
                var e = d.length;
                c = c || 0;
                for (0 > c && (c = Math.max(c + e, 0)); c < e; c++) {
                    var f = d[c];
                    if (f === b || Object.is(f, b)) return !0
                }
                return !1
            }
        });
        var n = this;

        function ka(a) {
            return void 0 !== a
        }

        function q(a) {
            return "string" == typeof a
        }
        var la = /^[\w+/_-]+[=]{0,2}$/,
            ma = null;

        function na() {}

        function oa(a) {
            a.V = void 0;
            a.Xa = function() {
                return a.V ? a.V : a.V = new a
            }
        }

        function pa(a) {
            var b = typeof a;
            if ("object" == b)
                if (a) {
                    if (a instanceof Array) return "array";
                    if (a instanceof Object) return b;
                    var c = Object.prototype.toString.call(a);
                    if ("[object Window]" == c) return "object";
                    if ("[object Array]" == c || "number" == typeof a.length && "undefined" != typeof a.splice && "undefined" != typeof a.propertyIsEnumerable && !a.propertyIsEnumerable("splice")) return "array";
                    if ("[object Function]" == c || "undefined" !=
                        typeof a.call && "undefined" != typeof a.propertyIsEnumerable && !a.propertyIsEnumerable("call")) return "function"
                } else return "null";
            else if ("function" == b && "undefined" == typeof a.call) return "object";
            return b
        }

        function qa(a) {
            return "array" == pa(a)
        }

        function ra(a) {
            var b = pa(a);
            return "array" == b || "object" == b && "number" == typeof a.length
        }

        function sa(a) {
            return "function" == pa(a)
        }

        function ta(a) {
            var b = typeof a;
            return "object" == b && null != a || "function" == b
        }
        var ua = "closure_uid_" + (1E9 * Math.random() >>> 0),
            va = 0;

        function wa(a, b, c) {
            return a.call.apply(a.bind,
                arguments)
        }

        function xa(a, b, c) {
            if (!a) throw Error();
            if (2 < arguments.length) {
                var d = Array.prototype.slice.call(arguments, 2);
                return function() {
                    var e = Array.prototype.slice.call(arguments);
                    Array.prototype.unshift.apply(e, d);
                    return a.apply(b, e)
                }
            }
            return function() {
                return a.apply(b, arguments)
            }
        }

        function t(a, b, c) {
            Function.prototype.bind && -1 != Function.prototype.bind.toString().indexOf("native code") ? t = wa : t = xa;
            return t.apply(null, arguments)
        }

        function ya(a, b) {
            var c = Array.prototype.slice.call(arguments, 1);
            return function() {
                var d =
                    c.slice();
                d.push.apply(d, arguments);
                return a.apply(this, d)
            }
        }

        function u(a, b) {
            for (var c in b) a[c] = b[c]
        }
        var za = Date.now || function() {
            return +new Date
        };

        function v(a, b) {
            a = a.split(".");
            var c = n;
            a[0] in c || "undefined" == typeof c.execScript || c.execScript("var " + a[0]);
            for (var d; a.length && (d = a.shift());) !a.length && ka(b) ? c[d] = b : c[d] && c[d] !== Object.prototype[d] ? c = c[d] : c = c[d] = {}
        }

        function w(a, b) {
            function c() {}
            c.prototype = b.prototype;
            a.L = b.prototype;
            a.prototype = new c;
            a.prototype.constructor = a;
            a.uc = function(d, e, f) {
                for (var g =
                        Array(arguments.length - 2), h = 2; h < arguments.length; h++) g[h - 2] = arguments[h];
                return b.prototype[e].apply(d, g)
            }
        }

        function Ba(a) {
            if (Error.captureStackTrace) Error.captureStackTrace(this, Ba);
            else {
                var b = Error().stack;
                b && (this.stack = b)
            }
            a && (this.message = String(a))
        }
        w(Ba, Error);
        Ba.prototype.name = "CustomError";
        var Ca;

        function Da(a, b) {
            a = a.split("%s");
            for (var c = "", d = a.length - 1, e = 0; e < d; e++) c += a[e] + (e < b.length ? b[e] : "%s");
            Ba.call(this, c + a[d])
        }
        w(Da, Ba);
        Da.prototype.name = "AssertionError";

        function Fa(a, b) {
            throw new Da("Failure" +
                (a ? ": " + a : ""), Array.prototype.slice.call(arguments, 1));
        }
        var Ga = Array.prototype.indexOf ? function(a, b) {
                return Array.prototype.indexOf.call(a, b, void 0)
            } : function(a, b) {
                if (q(a)) return q(b) && 1 == b.length ? a.indexOf(b, 0) : -1;
                for (var c = 0; c < a.length; c++)
                    if (c in a && a[c] === b) return c;
                return -1
            },
            Ha = Array.prototype.forEach ? function(a, b, c) {
                Array.prototype.forEach.call(a, b, c)
            } : function(a, b, c) {
                for (var d = a.length, e = q(a) ? a.split("") : a, f = 0; f < d; f++) f in e && b.call(c, e[f], f, a)
            };

        function Ia(a, b) {
            for (var c = q(a) ? a.split("") :
                    a, d = a.length - 1; 0 <= d; --d) d in c && b.call(void 0, c[d], d, a)
        }
        var Ja = Array.prototype.filter ? function(a, b) {
                return Array.prototype.filter.call(a, b, void 0)
            } : function(a, b) {
                for (var c = a.length, d = [], e = 0, f = q(a) ? a.split("") : a, g = 0; g < c; g++)
                    if (g in f) {
                        var h = f[g];
                        b.call(void 0, h, g, a) && (d[e++] = h)
                    } return d
            },
            Ka = Array.prototype.map ? function(a, b) {
                return Array.prototype.map.call(a, b, void 0)
            } : function(a, b) {
                for (var c = a.length, d = Array(c), e = q(a) ? a.split("") : a, f = 0; f < c; f++) f in e && (d[f] = b.call(void 0, e[f], f, a));
                return d
            },
            La = Array.prototype.some ?
            function(a, b) {
                return Array.prototype.some.call(a, b, void 0)
            } : function(a, b) {
                for (var c = a.length, d = q(a) ? a.split("") : a, e = 0; e < c; e++)
                    if (e in d && b.call(void 0, d[e], e, a)) return !0;
                return !1
            };

        function Ma(a, b, c) {
            for (var d = a.length, e = q(a) ? a.split("") : a, f = 0; f < d; f++)
                if (f in e && b.call(c, e[f], f, a)) return f;
            return -1
        }

        function Na(a, b) {
            return 0 <= Ga(a, b)
        }

        function Oa(a, b) {
            b = Ga(a, b);
            var c;
            (c = 0 <= b) && Pa(a, b);
            return c
        }

        function Pa(a, b) {
            return 1 == Array.prototype.splice.call(a, b, 1).length
        }

        function Qa(a, b) {
            b = Ma(a, b, void 0);
            0 <= b &&
                Pa(a, b)
        }

        function Ra(a, b) {
            var c = 0;
            Ia(a, function(d, e) {
                b.call(void 0, d, e, a) && Pa(a, e) && c++
            })
        }

        function Sa(a) {
            return Array.prototype.concat.apply([], arguments)
        }

        function Ta(a) {
            var b = a.length;
            if (0 < b) {
                for (var c = Array(b), d = 0; d < b; d++) c[d] = a[d];
                return c
            }
            return []
        }

        function Ua(a, b, c, d) {
            return Array.prototype.splice.apply(a, Va(arguments, 1))
        }

        function Va(a, b, c) {
            return 2 >= arguments.length ? Array.prototype.slice.call(a, b) : Array.prototype.slice.call(a, b, c)
        }
        var Wa = String.prototype.trim ? function(a) {
                return a.trim()
            } : function(a) {
                return /^[\s\xa0]*([\s\S]*?)[\s\xa0]*$/.exec(a)[1]
            },
            Xa = /&/g,
            Ya = /</g,
            Za = />/g,
            $a = /"/g,
            ab = /'/g,
            bb = /\x00/g,
            cb = /[\x00&<>"']/;

        function db(a, b) {
            return a < b ? -1 : a > b ? 1 : 0
        }

        function eb(a) {
            cb.test(a) && (-1 != a.indexOf("&") && (a = a.replace(Xa, "&amp;")), -1 != a.indexOf("<") && (a = a.replace(Ya, "&lt;")), -1 != a.indexOf(">") && (a = a.replace(Za, "&gt;")), -1 != a.indexOf('"') && (a = a.replace($a, "&quot;")), -1 != a.indexOf("'") && (a = a.replace(ab, "&#39;")), -1 != a.indexOf("\x00") && (a = a.replace(bb, "&#0;")));
            return a
        }

        function fb(a, b, c) {
            for (var d in a) b.call(c, a[d], d, a)
        }

        function gb(a) {
            var b = {},
                c;
            for (c in a) b[c] = a[c];
            return b
        }
        var hb = "constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");

        function ib(a, b) {
            for (var c, d, e = 1; e < arguments.length; e++) {
                d = arguments[e];
                for (c in d) a[c] = d[c];
                for (var f = 0; f < hb.length; f++) c = hb[f], Object.prototype.hasOwnProperty.call(d, c) && (a[c] = d[c])
            }
        }
        var jb = "StopIteration" in n ? n.StopIteration : {
            message: "StopIteration",
            stack: ""
        };

        function kb() {}
        kb.prototype.next = function() {
            throw jb;
        };
        kb.prototype.ha = function() {
            return this
        };

        function lb(a) {
            if (a instanceof kb) return a;
            if ("function" == typeof a.ha) return a.ha(!1);
            if (ra(a)) {
                var b = 0,
                    c = new kb;
                c.next = function() {
                    for (;;) {
                        if (b >= a.length) throw jb;
                        if (b in a) return a[b++];
                        b++
                    }
                };
                return c
            }
            throw Error("Not implemented");
        }

        function mb(a, b) {
            if (ra(a)) try {
                Ha(a, b, void 0)
            } catch (c) {
                if (c !== jb) throw c;
            } else {
                a = lb(a);
                try {
                    for (;;) b.call(void 0, a.next(), void 0, a)
                } catch (c$1) {
                    if (c$1 !== jb) throw c$1;
                }
            }
        }

        function nb(a) {
            if (ra(a)) return Ta(a);
            a = lb(a);
            var b = [];
            mb(a, function(c) {
                b.push(c)
            });
            return b
        }

        function ob(a,
            b) {
            this.g = {};
            this.a = [];
            this.j = this.h = 0;
            var c = arguments.length;
            if (1 < c) {
                if (c % 2) throw Error("Uneven number of arguments");
                for (var d = 0; d < c; d += 2) this.set(arguments[d], arguments[d + 1])
            } else if (a)
                if (a instanceof ob)
                    for (c = a.ja(), d = 0; d < c.length; d++) this.set(c[d], a.get(c[d]));
                else
                    for (d in a) this.set(d, a[d])
        }
        k = ob.prototype;
        k.la = function() {
            pb(this);
            for (var a = [], b = 0; b < this.a.length; b++) a.push(this.g[this.a[b]]);
            return a
        };
        k.ja = function() {
            pb(this);
            return this.a.concat()
        };
        k.clear = function() {
            this.g = {};
            this.j = this.h =
                this.a.length = 0
        };

        function pb(a) {
            if (a.h != a.a.length) {
                for (var b = 0, c = 0; b < a.a.length;) {
                    var d = a.a[b];
                    qb(a.g, d) && (a.a[c++] = d);
                    b++
                }
                a.a.length = c
            }
            if (a.h != a.a.length) {
                var e = {};
                for (c = b = 0; b < a.a.length;) d = a.a[b], qb(e, d) || (a.a[c++] = d, e[d] = 1), b++;
                a.a.length = c
            }
        }
        k.get = function(a, b) {
            return qb(this.g, a) ? this.g[a] : b
        };
        k.set = function(a, b) {
            qb(this.g, a) || (this.h++, this.a.push(a), this.j++);
            this.g[a] = b
        };
        k.forEach = function(a, b) {
            for (var c = this.ja(), d = 0; d < c.length; d++) {
                var e = c[d],
                    f = this.get(e);
                a.call(b, f, e, this)
            }
        };
        k.ha = function(a) {
            pb(this);
            var b = 0,
                c = this.j,
                d = this,
                e = new kb;
            e.next = function() {
                if (c != d.j) throw Error("The map has changed since the iterator was created");
                if (b >= d.a.length) throw jb;
                var f = d.a[b++];
                return a ? f : d.g[f]
            };
            return e
        };

        function qb(a, b) {
            return Object.prototype.hasOwnProperty.call(a, b)
        }
        var rb = /^(?:([^:/?#.]+):)?(?:\/\/(?:([^/?#]*)@)?([^/#?]*?)(?::([0-9]+))?(?=[/#?]|$))?([^?#]+)?(?:\?([^#]*))?(?:#([\s\S]*))?$/;

        function sb(a, b) {
            if (a) {
                a = a.split("&");
                for (var c = 0; c < a.length; c++) {
                    var d = a[c].indexOf("="),
                        e = null;
                    if (0 <= d) {
                        var f =
                            a[c].substring(0, d);
                        e = a[c].substring(d + 1)
                    } else f = a[c];
                    b(f, e ? decodeURIComponent(e.replace(/\+/g, " ")) : "")
                }
            }
        }

        function tb(a, b, c, d) {
            for (var e = c.length; 0 <= (b = a.indexOf(c, b)) && b < d;) {
                var f = a.charCodeAt(b - 1);
                if (38 == f || 63 == f)
                    if (f = a.charCodeAt(b + e), !f || 61 == f || 38 == f || 35 == f) return b;
                b += e + 1
            }
            return -1
        }
        var ub = /#|$/;

        function vb(a, b) {
            var c = a.search(ub),
                d = tb(a, 0, b, c);
            if (0 > d) return null;
            var e = a.indexOf("&", d);
            if (0 > e || e > c) e = c;
            d += b.length + 1;
            return decodeURIComponent(a.substr(d, e - d).replace(/\+/g, " "))
        }
        var wb = /[?&]($|#)/;

        function xb(a, b) {
            this.h = this.B = this.j = "";
            this.D = null;
            this.s = this.g = "";
            this.i = !1;
            var c;
            a instanceof xb ? (this.i = ka(b) ? b : a.i, yb(this, a.j), this.B = a.B, this.h = a.h, zb(this, a.D), this.g = a.g, Ab(this, Bb(a.a)), this.s = a.s) : a && (c = String(a).match(rb)) ? (this.i = !!b, yb(this, c[1] || "", !0), this.B = Cb(c[2] || ""), this.h = Cb(c[3] || "", !0), zb(this, c[4]), this.g = Cb(c[5] || "", !0), Ab(this, c[6] || "", !0), this.s = Cb(c[7] || "")) : (this.i = !!b, this.a = new Db(null, this.i))
        }
        xb.prototype.toString = function() {
            var a = [],
                b = this.j;
            b && a.push(Eb(b, Fb,
                !0), ":");
            var c = this.h;
            if (c || "file" == b) a.push("//"), (b = this.B) && a.push(Eb(b, Fb, !0), "@"), a.push(encodeURIComponent(String(c)).replace(/%25([0-9a-fA-F]{2})/g, "%$1")), c = this.D, null != c && a.push(":", String(c));
            if (c = this.g) this.h && "/" != c.charAt(0) && a.push("/"), a.push(Eb(c, "/" == c.charAt(0) ? Gb : Hb, !0));
            (c = this.a.toString()) && a.push("?", c);
            (c = this.s) && a.push("#", Eb(c, Ib));
            return a.join("")
        };

        function yb(a, b, c) {
            a.j = c ? Cb(b, !0) : b;
            a.j && (a.j = a.j.replace(/:$/, ""))
        }

        function zb(a, b) {
            if (b) {
                b = Number(b);
                if (isNaN(b) || 0 > b) throw Error("Bad port number " +
                    b);
                a.D = b
            } else a.D = null
        }

        function Ab(a, b, c) {
            b instanceof Db ? (a.a = b, Jb(a.a, a.i)) : (c || (b = Eb(b, Kb)), a.a = new Db(b, a.i))
        }

        function Lb(a) {
            return a instanceof xb ? new xb(a) : new xb(a, void 0)
        }

        function Mb(a, b) {
            a instanceof xb || (a = Lb(a));
            b instanceof xb || (b = Lb(b));
            var c = a;
            a = new xb(c);
            var d = !!b.j;
            d ? yb(a, b.j) : d = !!b.B;
            d ? a.B = b.B : d = !!b.h;
            d ? a.h = b.h : d = null != b.D;
            var e = b.g;
            if (d) zb(a, b.D);
            else if (d = !!b.g)
                if ("/" != e.charAt(0) && (c.h && !c.g ? e = "/" + e : (c = a.g.lastIndexOf("/"), -1 != c && (e = a.g.substr(0, c + 1) + e))), ".." == e || "." == e) e = "";
                else if (-1 != e.indexOf("./") || -1 != e.indexOf("/.")) {
                c = 0 == e.lastIndexOf("/", 0);
                e = e.split("/");
                for (var f = [], g = 0; g < e.length;) {
                    var h = e[g++];
                    "." == h ? c && g == e.length && f.push("") : ".." == h ? ((1 < f.length || 1 == f.length && "" != f[0]) && f.pop(), c && g == e.length && f.push("")) : (f.push(h), c = !0)
                }
                e = f.join("/")
            }
            d ? a.g = e : d = "" !== b.a.toString();
            d ? Ab(a, Bb(b.a)) : d = !!b.s;
            d && (a.s = b.s);
            return a
        }

        function Cb(a, b) {
            return a ? b ? decodeURI(a.replace(/%25/g, "%2525")) : decodeURIComponent(a) : ""
        }

        function Eb(a, b, c) {
            return q(a) ? (a = encodeURI(a).replace(b,
                Nb), c && (a = a.replace(/%25([0-9a-fA-F]{2})/g, "%$1")), a) : null
        }

        function Nb(a) {
            a = a.charCodeAt(0);
            return "%" + (a >> 4 & 15).toString(16) + (a & 15).toString(16)
        }
        var Fb = /[#\/\?@]/g,
            Hb = /[#\?:]/g,
            Gb = /[#\?]/g,
            Kb = /[#\?@]/g,
            Ib = /#/g;

        function Db(a, b) {
            this.g = this.a = null;
            this.h = a || null;
            this.j = !!b
        }

        function Ob(a) {
            a.a || (a.a = new ob, a.g = 0, a.h && sb(a.h, function(b, c) {
                a.add(decodeURIComponent(b.replace(/\+/g, " ")), c)
            }))
        }
        k = Db.prototype;
        k.add = function(a, b) {
            Ob(this);
            this.h = null;
            a = Pb(this, a);
            var c = this.a.get(a);
            c || this.a.set(a, c = []);
            c.push(b);
            this.g += 1;
            return this
        };

        function Qb(a, b) {
            Ob(a);
            b = Pb(a, b);
            qb(a.a.g, b) && (a.h = null, a.g -= a.a.get(b).length, a = a.a, qb(a.g, b) && (delete a.g[b], a.h--, a.j++, a.a.length > 2 * a.h && pb(a)))
        }
        k.clear = function() {
            this.a = this.h = null;
            this.g = 0
        };

        function Rb(a, b) {
            Ob(a);
            b = Pb(a, b);
            return qb(a.a.g, b)
        }
        k.forEach = function(a, b) {
            Ob(this);
            this.a.forEach(function(c, d) {
                Ha(c, function(e) {
                    a.call(b, e, d, this)
                }, this)
            }, this)
        };
        k.ja = function() {
            Ob(this);
            for (var a = this.a.la(), b = this.a.ja(), c = [], d = 0; d < b.length; d++)
                for (var e = a[d], f = 0; f < e.length; f++) c.push(b[d]);
            return c
        };
        k.la = function(a) {
            Ob(this);
            var b = [];
            if (q(a)) Rb(this, a) && (b = Sa(b, this.a.get(Pb(this, a))));
            else {
                a = this.a.la();
                for (var c = 0; c < a.length; c++) b = Sa(b, a[c])
            }
            return b
        };
        k.set = function(a, b) {
            Ob(this);
            this.h = null;
            a = Pb(this, a);
            Rb(this, a) && (this.g -= this.a.get(a).length);
            this.a.set(a, [b]);
            this.g += 1;
            return this
        };
        k.get = function(a, b) {
            if (!a) return b;
            a = this.la(a);
            return 0 < a.length ? String(a[0]) : b
        };
        k.toString = function() {
            if (this.h) return this.h;
            if (!this.a) return "";
            for (var a = [], b = this.a.ja(), c = 0; c < b.length; c++) {
                var d =
                    b[c],
                    e = encodeURIComponent(String(d));
                d = this.la(d);
                for (var f = 0; f < d.length; f++) {
                    var g = e;
                    "" !== d[f] && (g += "=" + encodeURIComponent(String(d[f])));
                    a.push(g)
                }
            }
            return this.h = a.join("&")
        };

        function Bb(a) {
            var b = new Db;
            b.h = a.h;
            a.a && (b.a = new ob(a.a), b.g = a.g);
            return b
        }

        function Pb(a, b) {
            b = String(b);
            a.j && (b = b.toLowerCase());
            return b
        }

        function Jb(a, b) {
            b && !a.j && (Ob(a), a.h = null, a.a.forEach(function(c, d) {
                    var e = d.toLowerCase();
                    d != e && (Qb(this, d), Qb(this, e), 0 < c.length && (this.h = null, this.a.set(Pb(this, e), Ta(c)), this.g += c.length))
                },
                a));
            a.j = b
        }

        function Sb(a) {
            this.a = Lb(a)
        }

        function Tb(a, b) {
            b ? a.a.a.set(x.Sa, b) : Qb(a.a.a, x.Sa)
        }

        function Ub(a, b) {
            null !== b ? a.a.a.set(x.Qa, b ? "1" : "0") : Qb(a.a.a, x.Qa)
        }

        function Vb(a) {
            return a.a.a.get(x.Pa) || null
        }

        function Wb(a, b) {
            b ? a.a.a.set(x.PROVIDER_ID, b) : Qb(a.a.a, x.PROVIDER_ID)
        }
        Sb.prototype.toString = function() {
            return this.a.toString()
        };
        var x = {
            Pa: "ui_auid",
            kc: "apiKey",
            Qa: "ui_sd",
            vb: "mode",
            $a: "oobCode",
            PROVIDER_ID: "ui_pid",
            Sa: "ui_sid",
            wb: "tenantId"
        };
        var Xb;
        a: {
            var Yb = n.navigator;
            if (Yb) {
                var Zb = Yb.userAgent;
                if (Zb) {
                    Xb =
                        Zb;
                    break a
                }
            }
            Xb = ""
        }

        function y(a) {
            return -1 != Xb.indexOf(a)
        }

        function $b() {
            return (y("Chrome") || y("CriOS")) && !y("Edge")
        }

        function ac(a) {
            ac[" "](a);
            return a
        }
        ac[" "] = na;

        function bc(a, b) {
            var c = cc;
            return Object.prototype.hasOwnProperty.call(c, a) ? c[a] : c[a] = b(a)
        }
        var dc = y("Opera"),
            z = y("Trident") || y("MSIE"),
            ec = y("Edge"),
            fc = ec || z,
            gc = y("Gecko") && !(-1 != Xb.toLowerCase().indexOf("webkit") && !y("Edge")) && !(y("Trident") || y("MSIE")) && !y("Edge"),
            hc = -1 != Xb.toLowerCase().indexOf("webkit") && !y("Edge"),
            ic = hc && y("Mobile"),
            jc =
            y("Macintosh");

        function kc() {
            var a = n.document;
            return a ? a.documentMode : void 0
        }
        var lc;
        a: {
            var mc = "",
                nc = function() {
                    var a = Xb;
                    if (gc) return /rv:([^\);]+)(\)|;)/.exec(a);
                    if (ec) return /Edge\/([\d\.]+)/.exec(a);
                    if (z) return /\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/.exec(a);
                    if (hc) return /WebKit\/(\S+)/.exec(a);
                    if (dc) return /(?:Version)[ \/]?(\S+)/.exec(a)
                }();nc && (mc = nc ? nc[1] : "");
            if (z) {
                var oc = kc();
                if (null != oc && oc > parseFloat(mc)) {
                    lc = String(oc);
                    break a
                }
            }
            lc = mc
        }
        var cc = {};

        function pc(a) {
            return bc(a, function() {
                for (var b = 0, c = Wa(String(lc)).split("."),
                        d = Wa(String(a)).split("."), e = Math.max(c.length, d.length), f = 0; 0 == b && f < e; f++) {
                    var g = c[f] || "",
                        h = d[f] || "";
                    do {
                        g = /(\d*)(\D*)(.*)/.exec(g) || ["", "", "", ""];
                        h = /(\d*)(\D*)(.*)/.exec(h) || ["", "", "", ""];
                        if (0 == g[0].length && 0 == h[0].length) break;
                        b = db(0 == g[1].length ? 0 : parseInt(g[1], 10), 0 == h[1].length ? 0 : parseInt(h[1], 10)) || db(0 == g[2].length, 0 == h[2].length) || db(g[2], h[2]);
                        g = g[3];
                        h = h[3]
                    } while (0 == b)
                }
                return 0 <= b
            })
        }
        var qc;
        var rc = n.document;
        qc = rc && z ? kc() || ("CSS1Compat" == rc.compatMode ? parseInt(lc, 10) : 5) : void 0;

        function sc(a,
            b) {
            this.a = a === tc && b || "";
            this.g = uc
        }
        sc.prototype.ma = !0;
        sc.prototype.ka = function() {
            return this.a
        };
        sc.prototype.toString = function() {
            return "Const{" + this.a + "}"
        };

        function vc(a) {
            if (a instanceof sc && a.constructor === sc && a.g === uc) return a.a;
            Fa("expected object of type Const, got '" + a + "'");
            return "type_error:Const"
        }
        var uc = {},
            tc = {};

        function wc() {
            this.a = "";
            this.h = xc
        }
        wc.prototype.ma = !0;
        wc.prototype.ka = function() {
            return this.a.toString()
        };
        wc.prototype.g = function() {
            return 1
        };
        wc.prototype.toString = function() {
            return "TrustedResourceUrl{" +
                this.a + "}"
        };

        function yc(a) {
            if (a instanceof wc && a.constructor === wc && a.h === xc) return a.a;
            Fa("expected object of type TrustedResourceUrl, got '" + a + "' of type " + pa(a));
            return "type_error:TrustedResourceUrl"
        }
        var xc = {};

        function zc(a) {
            var b = new wc;
            b.a = a;
            return b
        }

        function Ac() {
            this.a = "";
            this.h = Bc
        }
        Ac.prototype.ma = !0;
        Ac.prototype.ka = function() {
            return this.a.toString()
        };
        Ac.prototype.g = function() {
            return 1
        };
        Ac.prototype.toString = function() {
            return "SafeUrl{" + this.a + "}"
        };

        function Cc(a) {
            return Dc(a).toString()
        }

        function Dc(a) {
            if (a instanceof Ac && a.constructor === Ac && a.h === Bc) return a.a;
            Fa("expected object of type SafeUrl, got '" + a + "' of type " + pa(a));
            return "type_error:SafeUrl"
        }
        var Ec = /^(?:(?:https?|mailto|ftp):|[^:/?#]*(?:[/?#]|$))/i;

        function Fc(a) {
            if (a instanceof Ac) return a;
            a = "object" == typeof a && a.ma ? a.ka() : String(a);
            Ec.test(a) || (a = "about:invalid#zClosurez");
            return Gc(a)
        }
        var Bc = {};

        function Gc(a) {
            var b = new Ac;
            b.a = a;
            return b
        }
        Gc("about:blank");

        function Hc() {
            this.a = "";
            this.g = Ic
        }
        Hc.prototype.ma = !0;
        var Ic = {};
        Hc.prototype.ka = function() {
            return this.a
        };
        Hc.prototype.toString = function() {
            return "SafeStyle{" + this.a + "}"
        };

        function Jc() {
            this.a = "";
            this.j = Kc;
            this.h = null
        }
        Jc.prototype.g = function() {
            return this.h
        };
        Jc.prototype.ma = !0;
        Jc.prototype.ka = function() {
            return this.a.toString()
        };
        Jc.prototype.toString = function() {
            return "SafeHtml{" + this.a + "}"
        };

        function Lc(a) {
            if (a instanceof Jc && a.constructor === Jc && a.j === Kc) return a.a;
            Fa("expected object of type SafeHtml, got '" + a + "' of type " + pa(a));
            return "type_error:SafeHtml"
        }
        var Kc = {};

        function Mc(a, b) {
            var c = new Jc;
            c.a = a;
            c.h = b;
            return c
        }
        Mc("<!DOCTYPE html>", 0);
        var Nc = Mc("", 0);
        Mc("<br>", 0);
        var Oc = function(a) {
            var b = !1,
                c;
            return function() {
                b || (c = a(), b = !0);
                return c
            }
        }(function() {
            if ("undefined" === typeof document) return !1;
            var a = document.createElement("div"),
                b = document.createElement("div");
            b.appendChild(document.createElement("div"));
            a.appendChild(b);
            if (!a.firstChild) return !1;
            b = a.firstChild.firstChild;
            a.innerHTML = Lc(Nc);
            return !b.parentElement
        });

        function Pc(a, b) {
            a.src = yc(b);
            if (null === ma) b: {
                b = n.document;
                if ((b = b.querySelector &&
                        b.querySelector("script[nonce]")) && (b = b.nonce || b.getAttribute("nonce")) && la.test(b)) {
                    ma = b;
                    break b
                }
                ma = ""
            }
            b = ma;
            b && a.setAttribute("nonce", b)
        }

        function Qc(a, b) {
            this.a = ka(a) ? a : 0;
            this.g = ka(b) ? b : 0
        }
        Qc.prototype.toString = function() {
            return "(" + this.a + ", " + this.g + ")"
        };
        Qc.prototype.ceil = function() {
            this.a = Math.ceil(this.a);
            this.g = Math.ceil(this.g);
            return this
        };
        Qc.prototype.floor = function() {
            this.a = Math.floor(this.a);
            this.g = Math.floor(this.g);
            return this
        };
        Qc.prototype.round = function() {
            this.a = Math.round(this.a);
            this.g =
                Math.round(this.g);
            return this
        };

        function Rc(a, b) {
            this.width = a;
            this.height = b
        }
        k = Rc.prototype;
        k.toString = function() {
            return "(" + this.width + " x " + this.height + ")"
        };
        k.aspectRatio = function() {
            return this.width / this.height
        };
        k.ceil = function() {
            this.width = Math.ceil(this.width);
            this.height = Math.ceil(this.height);
            return this
        };
        k.floor = function() {
            this.width = Math.floor(this.width);
            this.height = Math.floor(this.height);
            return this
        };
        k.round = function() {
            this.width = Math.round(this.width);
            this.height = Math.round(this.height);
            return this
        };

        function Sc(a) {
            return a ? new Tc(Uc(a)) : Ca || (Ca = new Tc)
        }

        function Vc(a, b) {
            var c = b || document;
            return c.querySelectorAll && c.querySelector ? c.querySelectorAll("." + a) : Wc(document, a, b)
        }

        function Xc(a, b) {
            var c = b || document;
            if (c.getElementsByClassName) a = c.getElementsByClassName(a)[0];
            else {
                c = document;
                var d = b || c;
                a = d.querySelectorAll && d.querySelector && a ? d.querySelector(a ? "." + a : "") : Wc(c, a, b)[0] || null
            }
            return a || null
        }

        function Wc(a, b, c) {
            var d;
            a = c || a;
            if (a.querySelectorAll && a.querySelector && b) return a.querySelectorAll(b ?
                "." + b : "");
            if (b && a.getElementsByClassName) {
                var e = a.getElementsByClassName(b);
                return e
            }
            e = a.getElementsByTagName("*");
            if (b) {
                var f = {};
                for (c = d = 0; a = e[c]; c++) {
                    var g = a.className;
                    "function" == typeof g.split && Na(g.split(/\s+/), b) && (f[d++] = a)
                }
                f.length = d;
                return f
            }
            return e
        }

        function Yc(a, b) {
            fb(b, function(c, d) {
                c && "object" == typeof c && c.ma && (c = c.ka());
                "style" == d ? a.style.cssText = c : "class" == d ? a.className = c : "for" == d ? a.htmlFor = c : Zc.hasOwnProperty(d) ? a.setAttribute(Zc[d], c) : 0 == d.lastIndexOf("aria-", 0) || 0 == d.lastIndexOf("data-",
                    0) ? a.setAttribute(d, c) : a[d] = c
            })
        }
        var Zc = {
            cellpadding: "cellPadding",
            cellspacing: "cellSpacing",
            colspan: "colSpan",
            frameborder: "frameBorder",
            height: "height",
            maxlength: "maxLength",
            nonce: "nonce",
            role: "role",
            rowspan: "rowSpan",
            type: "type",
            usemap: "useMap",
            valign: "vAlign",
            width: "width"
        };

        function $c(a) {
            return a.scrollingElement ? a.scrollingElement : hc || "CSS1Compat" != a.compatMode ? a.body || a.documentElement : a.documentElement
        }

        function ad(a) {
            a && a.parentNode && a.parentNode.removeChild(a)
        }

        function Uc(a) {
            return 9 == a.nodeType ?
                a : a.ownerDocument || a.document
        }

        function bd(a, b) {
            if ("textContent" in a) a.textContent = b;
            else if (3 == a.nodeType) a.data = String(b);
            else if (a.firstChild && 3 == a.firstChild.nodeType) {
                for (; a.lastChild != a.firstChild;) a.removeChild(a.lastChild);
                a.firstChild.data = String(b)
            } else {
                for (var c; c = a.firstChild;) a.removeChild(c);
                a.appendChild(Uc(a).createTextNode(String(b)))
            }
        }

        function cd(a, b) {
            return b ? dd(a, function(c) {
                return !b || q(c.className) && Na(c.className.split(/\s+/), b)
            }) : null
        }

        function dd(a, b) {
            for (var c = 0; a;) {
                if (b(a)) return a;
                a = a.parentNode;
                c++
            }
            return null
        }

        function Tc(a) {
            this.a = a || n.document || document
        }
        Tc.prototype.O = function() {
            return q(void 0) ? this.a.getElementById(void 0) : void 0
        };
        var ed = {
                Ec: !0
            },
            fd = {
                Gc: !0
            },
            gd = {
                Dc: !0
            },
            hd = {
                Fc: !0
            };

        function id() {
            throw Error("Do not instantiate directly");
        }
        id.prototype.va = null;
        id.prototype.toString = function() {
            return this.content
        };

        function jd(a, b, c, d) {
            a = a(b || kd, void 0, c);
            d = (d || Sc()).a.createElement("DIV");
            a = ld(a);
            a.match(md);
            a = Mc(a, null);
            if (Oc())
                for (; d.lastChild;) d.removeChild(d.lastChild);
            d.innerHTML = Lc(a);
            1 == d.childNodes.length && (a = d.firstChild, 1 == a.nodeType && (d = a));
            return d
        }

        function ld(a) {
            if (!ta(a)) return eb(String(a));
            if (a instanceof id) {
                if (a.fa === ed) return a.content;
                if (a.fa === hd) return eb(a.content)
            }
            Fa("Soy template output is unsafe for use as HTML: " + a);
            return "zSoyz"
        }
        var md = /^<(body|caption|col|colgroup|head|html|tr|td|th|tbody|thead|tfoot)>/i,
            kd = {};

        function nd(a) {
            if (null != a) switch (a.va) {
                case 1:
                    return 1;
                case -1:
                    return -1;
                case 0:
                    return 0
            }
            return null
        }

        function od() {
            id.call(this)
        }
        w(od, id);
        od.prototype.fa = ed;

        function A(a) {
            return null != a && a.fa === ed ? a : a instanceof Jc ? B(Lc(a).toString(), a.g()) : B(eb(String(String(a))), nd(a))
        }

        function pd() {
            id.call(this)
        }
        w(pd, id);
        pd.prototype.fa = fd;
        pd.prototype.va = 1;

        function qd(a, b) {
            this.content = String(a);
            this.va = null != b ? b : null
        }
        w(qd, id);
        qd.prototype.fa = hd;

        function C(a) {
            return new qd(a, void 0)
        }
        var B = function(a) {
                function b(c) {
                    this.content = c
                }
                b.prototype = a.prototype;
                return function(c, d) {
                    c = new b(String(c));
                    void 0 !== d && (c.va = d);
                    return c
                }
            }(od),
            rd = function(a) {
                function b(c) {
                    this.content =
                        c
                }
                b.prototype = a.prototype;
                return function(c) {
                    return new b(String(c))
                }
            }(pd);

        function ud(a) {
            function b() {}
            var c = {
                label: D("New password")
            };
            b.prototype = a;
            a = new b;
            for (var d in c) a[d] = c[d];
            return a
        }

        function D(a) {
            return (a = String(a)) ? new qd(a, void 0) : ""
        }
        var vd = function(a) {
            function b(c) {
                this.content = c
            }
            b.prototype = a.prototype;
            return function(c, d) {
                c = String(c);
                if (!c) return "";
                c = new b(c);
                void 0 !== d && (c.va = d);
                return c
            }
        }(od);

        function wd(a) {
            return null != a && a.fa === ed ? String(String(a.content).replace(xd, "").replace(yd,
                "&lt;")).replace(zd, Ad) : eb(String(a))
        }

        function Bd(a) {
            null != a && a.fa === fd ? a = String(a).replace(Cd, Dd) : a instanceof Ac ? a = String(Cc(a)).replace(Cd, Dd) : (a = String(a), Ed.test(a) ? a = a.replace(Cd, Dd) : (Fa("Bad value `%s` for |filterNormalizeUri", [a]), a = "#zSoyz"));
            return a
        }

        function Fd(a) {
            null != a && a.fa === gd ? a = a.content : null == a ? a = "" : a instanceof Hc ? a instanceof Hc && a.constructor === Hc && a.g === Ic ? a = a.a : (Fa("expected object of type SafeStyle, got '" + a + "' of type " + pa(a)), a = "type_error:SafeStyle") : (a = String(a), Gd.test(a) ||
                (Fa("Bad value `%s` for |filterCssValue", [a]), a = "zSoyz"));
            return a
        }
        var Hd = {
            "\x00": "&#0;",
            "\t": "&#9;",
            "\n": "&#10;",
            "\x0B": "&#11;",
            "\f": "&#12;",
            "\r": "&#13;",
            " ": "&#32;",
            '"': "&quot;",
            "&": "&amp;",
            "'": "&#39;",
            "-": "&#45;",
            "/": "&#47;",
            "<": "&lt;",
            "=": "&#61;",
            ">": "&gt;",
            "`": "&#96;",
            "\u0085": "&#133;",
            "\u00a0": "&#160;",
            "\u2028": "&#8232;",
            "\u2029": "&#8233;"
        };

        function Ad(a) {
            return Hd[a]
        }
        var Id = {
            "\x00": "%00",
            "\u0001": "%01",
            "\u0002": "%02",
            "\u0003": "%03",
            "\u0004": "%04",
            "\u0005": "%05",
            "\u0006": "%06",
            "\u0007": "%07",
            "\b": "%08",
            "\t": "%09",
            "\n": "%0A",
            "\x0B": "%0B",
            "\f": "%0C",
            "\r": "%0D",
            "\u000e": "%0E",
            "\u000f": "%0F",
            "\u0010": "%10",
            "\u0011": "%11",
            "\u0012": "%12",
            "\u0013": "%13",
            "\u0014": "%14",
            "\u0015": "%15",
            "\u0016": "%16",
            "\u0017": "%17",
            "\u0018": "%18",
            "\u0019": "%19",
            "\u001a": "%1A",
            "\u001b": "%1B",
            "\u001c": "%1C",
            "\u001d": "%1D",
            "\u001e": "%1E",
            "\u001f": "%1F",
            " ": "%20",
            '"': "%22",
            "'": "%27",
            "(": "%28",
            ")": "%29",
            "<": "%3C",
            ">": "%3E",
            "\\": "%5C",
            "{": "%7B",
            "}": "%7D",
            "\u007f": "%7F",
            "\u0085": "%C2%85",
            "\u00a0": "%C2%A0",
            "\u2028": "%E2%80%A8",
            "\u2029": "%E2%80%A9",
            "\uff01": "%EF%BC%81",
            "\uff03": "%EF%BC%83",
            "\uff04": "%EF%BC%84",
            "\uff06": "%EF%BC%86",
            "\uff07": "%EF%BC%87",
            "\uff08": "%EF%BC%88",
            "\uff09": "%EF%BC%89",
            "\uff0a": "%EF%BC%8A",
            "\uff0b": "%EF%BC%8B",
            "\uff0c": "%EF%BC%8C",
            "\uff0f": "%EF%BC%8F",
            "\uff1a": "%EF%BC%9A",
            "\uff1b": "%EF%BC%9B",
            "\uff1d": "%EF%BC%9D",
            "\uff1f": "%EF%BC%9F",
            "\uff20": "%EF%BC%A0",
            "\uff3b": "%EF%BC%BB",
            "\uff3d": "%EF%BC%BD"
        };

        function Dd(a) {
            return Id[a]
        }
        var zd = /[\x00\x22\x27\x3c\x3e]/g,
            Cd = /[\x00- \x22\x27-\x29\x3c\x3e\\\x7b\x7d\x7f\x85\xa0\u2028\u2029\uff01\uff03\uff04\uff06-\uff0c\uff0f\uff1a\uff1b\uff1d\uff1f\uff20\uff3b\uff3d]/g,
            Gd = /^(?!-*(?:expression|(?:moz-)?binding))(?:[.#]?-?(?:[_a-z0-9-]+)(?:-[_a-z0-9-]+)*-?|-?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[a-z]{1,2}|%)?|!important|)$/i,
            Ed = /^(?![^#?]*\/(?:\.|%2E){2}(?:[\/?#]|$))(?:(?:https?|mailto):|[^&:\/?#]*(?:[\/?#]|$))/i,
            xd = /<(?:!|\/?([a-zA-Z][a-zA-Z0-9:\-]*))(?:[^>'"]|"[^"]*"|'[^']*')*>/g,
            yd = /</g;

        function Jd() {
            return C("Enter a valid phone number")
        }

        function Kd() {
            return C("Unable to send password reset code to specified email")
        }

        function Ld() {
            return C("Something went wrong. Please try again.")
        }

        function Md() {
            return C("This email already exists without any means of sign-in. Please reset the password to recover.")
        }

        function Nd(a) {
            a = a || {};
            var b = "";
            switch (a.code) {
                case "invalid-argument":
                    b += "Client specified an invalid argument.";
                    break;
                case "invalid-configuration":
                    b += "Client specified an invalid project configuration.";
                    break;
                case "failed-precondition":
                    b += "Request can not be executed in the current system state.";
                    break;
                case "out-of-range":
                    b += "Client specified an invalid range.";
                    break;
                case "unauthenticated":
                    b +=
                        "Request not authenticated due to missing, invalid, or expired OAuth token.";
                    break;
                case "permission-denied":
                    b += "Client does not have sufficient permission.";
                    break;
                case "not-found":
                    b += "Specified resource is not found.";
                    break;
                case "aborted":
                    b += "Concurrency conflict, such as read-modify-write conflict.";
                    break;
                case "already-exists":
                    b += "The resource that a client tried to create already exists.";
                    break;
                case "resource-exhausted":
                    b += "Either out of resource quota or reaching rate limiting.";
                    break;
                case "cancelled":
                    b +=
                        "Request cancelled by the client.";
                    break;
                case "data-loss":
                    b += "Unrecoverable data loss or data corruption.";
                    break;
                case "unknown":
                    b += "Unknown server error.";
                    break;
                case "internal":
                    b += "Internal server error.";
                    break;
                case "not-implemented":
                    b += "API method not implemented by the server.";
                    break;
                case "unavailable":
                    b += "Service unavailable.";
                    break;
                case "deadline-exceeded":
                    b += "Request deadline exceeded.";
                    break;
                case "auth/user-disabled":
                    b += "The user account has been disabled by an administrator.";
                    break;
                case "auth/timeout":
                    b +=
                        "The operation has timed out.";
                    break;
                case "auth/too-many-requests":
                    b += "We have blocked all requests from this device due to unusual activity. Try again later.";
                    break;
                case "auth/quota-exceeded":
                    b += "The quota for this operation has been exceeded. Try again later.";
                    break;
                case "auth/network-request-failed":
                    b += "A network error has occurred. Try again later.";
                    break;
                case "restart-process":
                    b += "An issue was encountered when authenticating your request. Please visit the URL that redirected you to this page again to restart the authentication process.";
                    break;
                case "no-matching-tenant-for-email":
                    b += "No sign-in provider is available for the given email, please try with a different email."
            }
            return C(b)
        }

        function Od() {
            return C("Please login again to perform this operation")
        }

        function Pd(a, b, c) {
            var d = Error.call(this);
            this.message = d.message;
            "stack" in d && (this.stack = d.stack);
            this.code = Qd + a;
            if (!(a = b)) {
                a = "";
                switch (this.code) {
                    case "firebaseui/merge-conflict":
                        a += "The current anonymous user failed to upgrade. The non-anonymous credential is already associated with a different user account.";
                        break;
                    default:
                        a += Ld()
                }
                a = C(a).toString()
            }
            this.message = a || "";
            this.credential = c || null
        }
        m(Pd, Error);
        Pd.prototype.aa = function() {
            return {
                code: this.code,
                message: this.message
            }
        };
        Pd.prototype.toJSON = function() {
            return this.aa()
        };
        var Qd = "firebaseui/";

        function Rd() {
            0 != Sd && (Td[this[ua] || (this[ua] = ++va)] = this);
            this.T = this.T;
            this.D = this.D
        }
        var Sd = 0,
            Td = {};
        Rd.prototype.T = !1;
        Rd.prototype.o = function() {
            if (!this.T && (this.T = !0, this.m(), 0 != Sd)) {
                var a = this[ua] || (this[ua] = ++va);
                if (0 != Sd && this.D && 0 < this.D.length) throw Error(this +
                    " did not empty its onDisposeCallbacks queue. This probably means it overrode dispose() or disposeInternal() without calling the superclass' method.");
                delete Td[a]
            }
        };

        function Ud(a, b) {
            a.T ? ka(void 0) ? b.call(void 0) : b() : (a.D || (a.D = []), a.D.push(ka(void 0) ? t(b, void 0) : b))
        }
        Rd.prototype.m = function() {
            if (this.D)
                for (; this.D.length;) this.D.shift()()
        };

        function Vd(a) {
            a && "function" == typeof a.o && a.o()
        }
        var Wd = Object.freeze || function(a) {
            return a
        };
        var Xd = !z || 9 <= Number(qc),
            Yd = z && !pc("9"),
            Zd = function() {
                if (!n.addEventListener ||
                    !Object.defineProperty) return !1;
                var a = !1,
                    b = Object.defineProperty({}, "passive", {
                        get: function() {
                            a = !0
                        }
                    });
                try {
                    n.addEventListener("test", na, b), n.removeEventListener("test", na, b)
                } catch (c) {}
                return a
            }();

        function $d(a, b) {
            this.type = a;
            this.g = this.target = b;
            this.h = !1;
            this.rb = !0
        }
        $d.prototype.stopPropagation = function() {
            this.h = !0
        };
        $d.prototype.preventDefault = function() {
            this.rb = !1
        };

        function ae(a, b) {
            $d.call(this, a ? a.type : "");
            this.relatedTarget = this.g = this.target = null;
            this.button = this.screenY = this.screenX = this.clientY =
                this.clientX = 0;
            this.key = "";
            this.j = this.keyCode = 0;
            this.metaKey = this.shiftKey = this.altKey = this.ctrlKey = !1;
            this.pointerId = 0;
            this.pointerType = "";
            this.a = null;
            if (a) {
                var c = this.type = a.type,
                    d = a.changedTouches && a.changedTouches.length ? a.changedTouches[0] : null;
                this.target = a.target || a.srcElement;
                this.g = b;
                if (b = a.relatedTarget) {
                    if (gc) {
                        a: {
                            try {
                                ac(b.nodeName);
                                var e = !0;
                                break a
                            } catch (f) {}
                            e = !1
                        }
                        e || (b = null)
                    }
                } else "mouseover" == c ? b = a.fromElement : "mouseout" == c && (b = a.toElement);
                this.relatedTarget = b;
                d ? (this.clientX = void 0 !==
                    d.clientX ? d.clientX : d.pageX, this.clientY = void 0 !== d.clientY ? d.clientY : d.pageY, this.screenX = d.screenX || 0, this.screenY = d.screenY || 0) : (this.clientX = void 0 !== a.clientX ? a.clientX : a.pageX, this.clientY = void 0 !== a.clientY ? a.clientY : a.pageY, this.screenX = a.screenX || 0, this.screenY = a.screenY || 0);
                this.button = a.button;
                this.keyCode = a.keyCode || 0;
                this.key = a.key || "";
                this.j = a.charCode || ("keypress" == c ? a.keyCode : 0);
                this.ctrlKey = a.ctrlKey;
                this.altKey = a.altKey;
                this.shiftKey = a.shiftKey;
                this.metaKey = a.metaKey;
                this.pointerId =
                    a.pointerId || 0;
                this.pointerType = q(a.pointerType) ? a.pointerType : be[a.pointerType] || "";
                this.a = a;
                a.defaultPrevented && this.preventDefault()
            }
        }
        w(ae, $d);
        var be = Wd({
            2: "touch",
            3: "pen",
            4: "mouse"
        });
        ae.prototype.stopPropagation = function() {
            ae.L.stopPropagation.call(this);
            this.a.stopPropagation ? this.a.stopPropagation() : this.a.cancelBubble = !0
        };
        ae.prototype.preventDefault = function() {
            ae.L.preventDefault.call(this);
            var a = this.a;
            if (a.preventDefault) a.preventDefault();
            else if (a.returnValue = !1, Yd) try {
                if (a.ctrlKey || 112 <=
                    a.keyCode && 123 >= a.keyCode) a.keyCode = -1
            } catch (b) {}
        };
        var ce = "closure_listenable_" + (1E6 * Math.random() | 0),
            de = 0;

        function ee(a, b, c, d, e) {
            this.listener = a;
            this.proxy = null;
            this.src = b;
            this.type = c;
            this.capture = !!d;
            this.Ka = e;
            this.key = ++de;
            this.sa = this.Ha = !1
        }

        function fe(a) {
            a.sa = !0;
            a.listener = null;
            a.proxy = null;
            a.src = null;
            a.Ka = null
        }

        function ge(a) {
            this.src = a;
            this.a = {};
            this.g = 0
        }
        ge.prototype.add = function(a, b, c, d, e) {
            var f = a.toString();
            a = this.a[f];
            a || (a = this.a[f] = [], this.g++);
            var g = he(a, b, d, e); - 1 < g ? (b = a[g], c || (b.Ha = !1)) :
                (b = new ee(b, this.src, f, !!d, e), b.Ha = c, a.push(b));
            return b
        };

        function ie(a, b) {
            var c = b.type;
            c in a.a && Oa(a.a[c], b) && (fe(b), 0 == a.a[c].length && (delete a.a[c], a.g--))
        }

        function he(a, b, c, d) {
            for (var e = 0; e < a.length; ++e) {
                var f = a[e];
                if (!f.sa && f.listener == b && f.capture == !!c && f.Ka == d) return e
            }
            return -1
        }
        var je = "closure_lm_" + (1E6 * Math.random() | 0),
            ke = {},
            le = 0;

        function me(a, b, c, d, e) {
            if (d && d.once) return ne(a, b, c, d, e);
            if (qa(b)) {
                for (var f = 0; f < b.length; f++) me(a, b[f], c, d, e);
                return null
            }
            c = oe(c);
            return a && a[ce] ? a.K.add(String(b),
                c, !1, ta(d) ? !!d.capture : !!d, e) : pe(a, b, c, !1, d, e)
        }

        function pe(a, b, c, d, e, f) {
            if (!b) throw Error("Invalid event type");
            var g = ta(e) ? !!e.capture : !!e,
                h = qe(a);
            h || (a[je] = h = new ge(a));
            c = h.add(b, c, d, g, f);
            if (c.proxy) return c;
            d = re();
            c.proxy = d;
            d.src = a;
            d.listener = c;
            if (a.addEventListener) Zd || (e = g), void 0 === e && (e = !1), a.addEventListener(b.toString(), d, e);
            else if (a.attachEvent) a.attachEvent(se(b.toString()), d);
            else if (a.addListener && a.removeListener) a.addListener(d);
            else throw Error("addEventListener and attachEvent are unavailable.");
            le++;
            return c
        }

        function re() {
            var a = te,
                b = Xd ? function(c) {
                    return a.call(b.src, b.listener, c)
                } : function(c) {
                    c = a.call(b.src, b.listener, c);
                    if (!c) return c
                };
            return b
        }

        function ne(a, b, c, d, e) {
            if (qa(b)) {
                for (var f = 0; f < b.length; f++) ne(a, b[f], c, d, e);
                return null
            }
            c = oe(c);
            return a && a[ce] ? a.K.add(String(b), c, !0, ta(d) ? !!d.capture : !!d, e) : pe(a, b, c, !0, d, e)
        }

        function ue(a, b, c, d, e) {
            if (qa(b))
                for (var f = 0; f < b.length; f++) ue(a, b[f], c, d, e);
            else(d = ta(d) ? !!d.capture : !!d, c = oe(c), a && a[ce]) ? (a = a.K, b = String(b).toString(), b in a.a && (f = a.a[b],
                c = he(f, c, d, e), -1 < c && (fe(f[c]), Pa(f, c), 0 == f.length && (delete a.a[b], a.g--)))) : a && (a = qe(a)) && (b = a.a[b.toString()], a = -1, b && (a = he(b, c, d, e)), (c = -1 < a ? b[a] : null) && ve(c))
        }

        function ve(a) {
            if ("number" != typeof a && a && !a.sa) {
                var b = a.src;
                if (b && b[ce]) ie(b.K, a);
                else {
                    var c = a.type,
                        d = a.proxy;
                    b.removeEventListener ? b.removeEventListener(c, d, a.capture) : b.detachEvent ? b.detachEvent(se(c), d) : b.addListener && b.removeListener && b.removeListener(d);
                    le--;
                    (c = qe(b)) ? (ie(c, a), 0 == c.g && (c.src = null, b[je] = null)) : fe(a)
                }
            }
        }

        function se(a) {
            return a in
                ke ? ke[a] : ke[a] = "on" + a
        }

        function we(a, b, c, d) {
            var e = !0;
            if (a = qe(a))
                if (b = a.a[b.toString()])
                    for (b = b.concat(), a = 0; a < b.length; a++) {
                        var f = b[a];
                        f && f.capture == c && !f.sa && (f = xe(f, d), e = e && !1 !== f)
                    }
            return e
        }

        function xe(a, b) {
            var c = a.listener,
                d = a.Ka || a.src;
            a.Ha && ve(a);
            return c.call(d, b)
        }

        function te(a, b) {
            if (a.sa) return !0;
            if (!Xd) {
                if (!b) a: {
                    b = ["window", "event"];
                    for (var c = n, d = 0; d < b.length; d++)
                        if (c = c[b[d]], null == c) {
                            b = null;
                            break a
                        } b = c
                }
                d = b;
                b = new ae(d, this);
                c = !0;
                if (!(0 > d.keyCode || void 0 != d.returnValue)) {
                    a: {
                        var e = !1;
                        if (0 == d.keyCode) try {
                            d.keyCode = -1;
                            break a
                        } catch (g) {
                            e = !0
                        }
                        if (e || void 0 == d.returnValue) d.returnValue = !0
                    }
                    d = [];
                    for (e = b.g; e; e = e.parentNode) d.push(e);a = a.type;
                    for (e = d.length - 1; !b.h && 0 <= e; e--) {
                        b.g = d[e];
                        var f = we(d[e], a, !0, b);
                        c = c && f
                    }
                    for (e = 0; !b.h && e < d.length; e++) b.g = d[e],
                    f = we(d[e], a, !1, b),
                    c = c && f
                }
                return c
            }
            return xe(a, new ae(b, this))
        }

        function qe(a) {
            a = a[je];
            return a instanceof ge ? a : null
        }
        var ye = "__closure_events_fn_" + (1E9 * Math.random() >>> 0);

        function oe(a) {
            if (sa(a)) return a;
            a[ye] || (a[ye] = function(b) {
                return a.handleEvent(b)
            });
            return a[ye]
        }

        function E() {
            Rd.call(this);
            this.K = new ge(this);
            this.xb = this;
            this.Fa = null
        }
        w(E, Rd);
        E.prototype[ce] = !0;
        E.prototype.Za = function(a) {
            this.Fa = a
        };
        E.prototype.removeEventListener = function(a, b, c, d) {
            ue(this, a, b, c, d)
        };

        function ze(a, b) {
            var c, d = a.Fa;
            if (d)
                for (c = []; d; d = d.Fa) c.push(d);
            a = a.xb;
            d = b.type || b;
            if (q(b)) b = new $d(b, a);
            else if (b instanceof $d) b.target = b.target || a;
            else {
                var e = b;
                b = new $d(d, a);
                ib(b, e)
            }
            e = !0;
            if (c)
                for (var f = c.length - 1; !b.h && 0 <= f; f--) {
                    var g = b.g = c[f];
                    e = Ae(g, d, !0, b) && e
                }
            b.h || (g = b.g = a, e = Ae(g, d, !0, b) && e, b.h || (e = Ae(g, d, !1, b) && e));
            if (c)
                for (f = 0; !b.h && f < c.length; f++) g = b.g = c[f], e = Ae(g, d, !1, b) && e;
            return e
        }
        E.prototype.m = function() {
            E.L.m.call(this);
            if (this.K) {
                var a = this.K,
                    b = 0,
                    c;
                for (c in a.a) {
                    for (var d = a.a[c], e = 0; e < d.length; e++) ++b, fe(d[e]);
                    delete a.a[c];
                    a.g--
                }
            }
            this.Fa = null
        };

        function Ae(a, b, c, d) {
            b = a.K.a[String(b)];
            if (!b) return !0;
            b = b.concat();
            for (var e = !0, f = 0; f < b.length; ++f) {
                var g = b[f];
                if (g && !g.sa && g.capture == c) {
                    var h = g.listener,
                        l = g.Ka || g.src;
                    g.Ha && ie(a.K, g);
                    e = !1 !== h.call(l, d) && e
                }
            }
            return e && 0 != d.rb
        }
        var Be = {},
            Ce = 0;

        function De(a, b) {
            if (!a) throw Error("Event target element must be provided!");
            a = Ee(a);
            if (Be[a] && Be[a].length)
                for (var c = 0; c < Be[a].length; c++) ze(Be[a][c], b)
        }

        function Fe(a) {
            var b = Ee(a.O());
            Be[b] && Be[b].length && (Qa(Be[b], function(c) {
                return c == a
            }), Be[b].length || delete Be[b])
        }

        function Ee(a) {
            "undefined" === typeof a.a && (a.a = Ce, Ce++);
            return a.a
        }

        function Ge(a) {
            if (!a) throw Error("Event target element must be provided!");
            E.call(this);
            this.a = a
        }
        m(Ge, E);
        Ge.prototype.O = function() {
            return this.a
        };
        Ge.prototype.register = function() {
            var a = Ee(this.O());
            Be[a] ? Na(Be[a], this) || Be[a].push(this) : Be[a] = [this]
        };

        function He(a) {
            if (!a) return !1;
            try {
                return !!a.$goog_Thenable
            } catch (b) {
                return !1
            }
        }

        function Ie(a, b) {
            this.h = a;
            this.j = b;
            this.g = 0;
            this.a = null
        }
        Ie.prototype.get = function() {
            if (0 < this.g) {
                this.g--;
                var a = this.a;
                this.a = a.next;
                a.next = null
            } else a = this.h();
            return a
        };

        function Je(a, b) {
            a.j(b);
            100 > a.g && (a.g++, b.next = a.a, a.a = b)
        }

        function Ke() {
            this.g = this.a = null
        }
        var Me = new Ie(function() {
            return new Le
        }, function(a) {
            a.reset()
        });
        Ke.prototype.add = function(a, b) {
            var c = Me.get();
            c.set(a, b);
            this.g ? this.g.next = c : this.a = c;
            this.g =
                c
        };

        function Ne() {
            var a = Oe,
                b = null;
            a.a && (b = a.a, a.a = a.a.next, a.a || (a.g = null), b.next = null);
            return b
        }

        function Le() {
            this.next = this.g = this.a = null
        }
        Le.prototype.set = function(a, b) {
            this.a = a;
            this.g = b;
            this.next = null
        };
        Le.prototype.reset = function() {
            this.next = this.g = this.a = null
        };

        function Pe(a) {
            n.setTimeout(function() {
                throw a;
            }, 0)
        }
        var Qe;

        function Re() {
            var a = n.MessageChannel;
            "undefined" === typeof a && "undefined" !== typeof window && window.postMessage && window.addEventListener && !y("Presto") && (a = function() {
                var e = document.createElement("IFRAME");
                e.style.display = "none";
                e.src = "";
                document.documentElement.appendChild(e);
                var f = e.contentWindow;
                e = f.document;
                e.open();
                e.write("");
                e.close();
                var g = "callImmediate" + Math.random(),
                    h = "file:" == f.location.protocol ? "*" : f.location.protocol + "//" + f.location.host;
                e = t(function(l) {
                    if (("*" == h || l.origin == h) && l.data == g) this.port1.onmessage()
                }, this);
                f.addEventListener("message", e, !1);
                this.port1 = {};
                this.port2 = {
                    postMessage: function() {
                        f.postMessage(g, h)
                    }
                }
            });
            if ("undefined" !== typeof a && !y("Trident") && !y("MSIE")) {
                var b = new a,
                    c = {},
                    d = c;
                b.port1.onmessage = function() {
                    if (ka(c.next)) {
                        c = c.next;
                        var e = c.gb;
                        c.gb = null;
                        e()
                    }
                };
                return function(e) {
                    d.next = {
                        gb: e
                    };
                    d = d.next;
                    b.port2.postMessage(0)
                }
            }
            return "undefined" !== typeof document && "onreadystatechange" in document.createElement("SCRIPT") ? function(e) {
                var f = document.createElement("SCRIPT");
                f.onreadystatechange = function() {
                    f.onreadystatechange = null;
                    f.parentNode.removeChild(f);
                    f = null;
                    e();
                    e = null
                };
                document.documentElement.appendChild(f)
            } : function(e) {
                n.setTimeout(e, 0)
            }
        }

        function Se(a, b) {
            Te || Ue();
            Ve || (Te(), Ve = !0);
            Oe.add(a, b)
        }
        var Te;

        function Ue() {
            if (n.Promise && n.Promise.resolve) {
                var a = n.Promise.resolve(void 0);
                Te = function() {
                    a.then(We)
                }
            } else Te = function() {
                var b = We;
                !sa(n.setImmediate) || n.Window && n.Window.prototype && !y("Edge") && n.Window.prototype.setImmediate == n.setImmediate ? (Qe || (Qe = Re()), Qe(b)) : n.setImmediate(b)
            }
        }
        var Ve = !1,
            Oe = new Ke;

        function We() {
            for (var a; a = Ne();) {
                try {
                    a.a.call(a.g)
                } catch (b) {
                    Pe(b)
                }
                Je(Me, a)
            }
            Ve = !1
        }

        function F(a) {
            this.a = Xe;
            this.B = void 0;
            this.j = this.g = this.h = null;
            this.s = this.i = !1;
            if (a != na) try {
                var b = this;
                a.call(void 0, function(c) {
                    Ye(b, Ze, c)
                }, function(c) {
                    if (!(c instanceof $e)) try {
                        if (c instanceof Error) throw c;
                        throw Error("Promise rejected.");
                    } catch (d) {}
                    Ye(b, af, c)
                })
            } catch (c) {
                Ye(this, af, c)
            }
        }
        var Xe = 0,
            Ze = 2,
            af = 3;

        function bf() {
            this.next = this.j = this.g = this.s = this.a = null;
            this.h = !1
        }
        bf.prototype.reset = function() {
            this.j = this.g = this.s = this.a = null;
            this.h = !1
        };
        var cf = new Ie(function() {
            return new bf
        }, function(a) {
            a.reset()
        });

        function df(a, b, c) {
            var d = cf.get();
            d.s = a;
            d.g = b;
            d.j = c;
            return d
        }

        function G(a) {
            if (a instanceof F) return a;
            var b = new F(na);
            Ye(b, Ze, a);
            return b
        }

        function ef(a) {
            return new F(function(b, c) {
                c(a)
            })
        }
        F.prototype.then = function(a, b, c) {
            return ff(this, sa(a) ? a : null, sa(b) ? b : null, c)
        };
        F.prototype.$goog_Thenable = !0;
        k = F.prototype;
        k.ec = function(a, b) {
            a = df(a, a, b);
            a.h = !0;
            gf(this, a);
            return this
        };
        k.ta = function(a, b) {
            return ff(this, null, a, b)
        };
        k.cancel = function(a) {
            this.a == Xe && Se(function() {
                var b = new $e(a);
                hf(this, b)
            }, this)
        };

        function hf(a, b) {
            if (a.a == Xe)
                if (a.h) {
                    var c = a.h;
                    if (c.g) {
                        for (var d = 0, e = null, f = null, g = c.g; g && (g.h ||
                                (d++, g.a == a && (e = g), !(e && 1 < d))); g = g.next) e || (f = g);
                        e && (c.a == Xe && 1 == d ? hf(c, b) : (f ? (d = f, d.next == c.j && (c.j = d), d.next = d.next.next) : jf(c), kf(c, e, af, b)))
                    }
                    a.h = null
                } else Ye(a, af, b)
        }

        function gf(a, b) {
            a.g || a.a != Ze && a.a != af || lf(a);
            a.j ? a.j.next = b : a.g = b;
            a.j = b
        }

        function ff(a, b, c, d) {
            var e = df(null, null, null);
            e.a = new F(function(f, g) {
                e.s = b ? function(h) {
                    try {
                        var l = b.call(d, h);
                        f(l)
                    } catch (p) {
                        g(p)
                    }
                } : f;
                e.g = c ? function(h) {
                    try {
                        var l = c.call(d, h);
                        !ka(l) && h instanceof $e ? g(h) : f(l)
                    } catch (p) {
                        g(p)
                    }
                } : g
            });
            e.a.h = a;
            gf(a, e);
            return e.a
        }
        k.gc =
            function(a) {
                this.a = Xe;
                Ye(this, Ze, a)
            };
        k.hc = function(a) {
            this.a = Xe;
            Ye(this, af, a)
        };

        function Ye(a, b, c) {
            if (a.a == Xe) {
                a === c && (b = af, c = new TypeError("Promise cannot resolve to itself"));
                a.a = 1;
                a: {
                    var d = c,
                        e = a.gc,
                        f = a.hc;
                    if (d instanceof F) {
                        gf(d, df(e || na, f || null, a));
                        var g = !0
                    } else if (He(d)) d.then(e, f, a),
                    g = !0;
                    else {
                        if (ta(d)) try {
                            var h = d.then;
                            if (sa(h)) {
                                mf(d, h, e, f, a);
                                g = !0;
                                break a
                            }
                        } catch (l) {
                            f.call(a, l);
                            g = !0;
                            break a
                        }
                        g = !1
                    }
                }
                g || (a.B = c, a.a = b, a.h = null, lf(a), b != af || c instanceof $e || nf(a, c))
            }
        }

        function mf(a, b, c, d, e) {
            function f(l) {
                h ||
                    (h = !0, d.call(e, l))
            }

            function g(l) {
                h || (h = !0, c.call(e, l))
            }
            var h = !1;
            try {
                b.call(a, g, f)
            } catch (l) {
                f(l)
            }
        }

        function lf(a) {
            a.i || (a.i = !0, Se(a.Gb, a))
        }

        function jf(a) {
            var b = null;
            a.g && (b = a.g, a.g = b.next, b.next = null);
            a.g || (a.j = null);
            return b
        }
        k.Gb = function() {
            for (var a; a = jf(this);) kf(this, a, this.a, this.B);
            this.i = !1
        };

        function kf(a, b, c, d) {
            if (c == af && b.g && !b.h)
                for (; a && a.s; a = a.h) a.s = !1;
            if (b.a) b.a.h = null, of (b, c, d);
            else try {
                b.h ? b.s.call(b.j) : of (b, c, d)
            } catch (e) {
                pf.call(null, e)
            }
            Je(cf, b)
        }

        function of (a, b, c) {
            b == Ze ? a.s.call(a.j,
                c) : a.g && a.g.call(a.j, c)
        }

        function nf(a, b) {
            a.s = !0;
            Se(function() {
                a.s && pf.call(null, b)
            })
        }
        var pf = Pe;

        function $e(a) {
            Ba.call(this, a)
        }
        w($e, Ba);
        $e.prototype.name = "cancel";

        function qf(a, b, c) {
            b || (b = {});
            c = c || window;
            var d = a instanceof Ac ? a : Fc("undefined" != typeof a.href ? a.href : String(a));
            a = b.target || a.target;
            var e = [];
            for (f in b) switch (f) {
                case "width":
                case "height":
                case "top":
                case "left":
                    e.push(f + "=" + b[f]);
                    break;
                case "target":
                case "noopener":
                case "noreferrer":
                    break;
                default:
                    e.push(f + "=" + (b[f] ? 1 : 0))
            }
            var f = e.join(",");
            (y("iPhone") && !y("iPod") && !y("iPad") || y("iPad") || y("iPod")) && c.navigator && c.navigator.standalone && a && "_self" != a ? (f = c.document.createElement("A"), d instanceof Ac || d instanceof Ac || (d = "object" == typeof d && d.ma ? d.ka() : String(d), Ec.test(d) || (d = "about:invalid#zClosurez"), d = Gc(d)), f.href = Dc(d), f.setAttribute("target", a), b.noreferrer && f.setAttribute("rel", "noreferrer"), b = document.createEvent("MouseEvent"), b.initMouseEvent("click", !0, !0, c, 1), f.dispatchEvent(b), c = {}) : b.noreferrer ? (c = c.open("", a, f), b = Cc(d),
                c && (fc && -1 != b.indexOf(";") && (b = "'" + b.replace(/'/g, "%27") + "'"), c.opener = null, b = Mc('<meta name="referrer" content="no-referrer"><meta http-equiv="refresh" content="0; url=' + eb(b) + '">', null), c.document.write(Lc(b)), c.document.close())) : (c = c.open(Cc(d), a, f)) && b.noopener && (c.opener = null);
            return c
        }

        function rf(a) {
            window.location.assign(Cc(Fc(a)))
        }

        function sf() {
            try {
                return !!(window.opener && window.opener.location && window.opener.location.assign && window.opener.location.hostname === window.location.hostname && window.opener.location.protocol ===
                    window.location.protocol)
            } catch (a$2) {}
            return !1
        }

        function tf(a) {
            qf(a, {
                target: window.cordova && window.cordova.InAppBrowser ? "_system" : "_blank"
            }, void 0)
        }

        function uf(a, b) {
            a = ta(a) && 1 == a.nodeType ? a : document.querySelector(String(a));
            if (null == a) throw Error(b || "Cannot find element.");
            return a
        }

        function vf() {
            return window.location.href
        }

        function wf() {
            var a = null;
            return (new F(function(b) {
                "complete" == n.document.readyState ? b() : (a = function() {
                    b()
                }, ne(window, "load", a))
            })).ta(function(b) {
                ue(window, "load", a);
                throw b;
            })
        }

        function xf() {
            for (var a = 32, b = []; 0 < a;) b.push("1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(Math.floor(62 * Math.random()))), a--;
            return b.join("")
        }

        function yf(a, b, c) {
            c = void 0 === c ? {} : c;
            return Object.keys(a).filter(function(d) {
                return b.includes(d)
            }).reduce(function(d, e) {
                d[e] = a[e];
                return d
            }, c)
        }

        function zf(a) {
            var b = Af;
            this.s = [];
            this.T = b;
            this.P = a || null;
            this.j = this.a = !1;
            this.h = void 0;
            this.K = this.l = this.B = !1;
            this.i = 0;
            this.g = null;
            this.D = 0
        }
        zf.prototype.cancel = function(a) {
            if (this.a) this.h instanceof
            zf && this.h.cancel();
            else {
                if (this.g) {
                    var b = this.g;
                    delete this.g;
                    a ? b.cancel(a) : (b.D--, 0 >= b.D && b.cancel())
                }
                this.T ? this.T.call(this.P, this) : this.K = !0;
                this.a || (a = new Bf(this), Cf(this), Df(this, !1, a))
            }
        };
        zf.prototype.M = function(a, b) {
            this.B = !1;
            Df(this, a, b)
        };

        function Df(a, b, c) {
            a.a = !0;
            a.h = c;
            a.j = !b;
            Ef(a)
        }

        function Cf(a) {
            if (a.a) {
                if (!a.K) throw new Ff(a);
                a.K = !1
            }
        }
        zf.prototype.callback = function(a) {
            Cf(this);
            Df(this, !0, a)
        };

        function Gf(a, b, c) {
            a.s.push([b, c, void 0]);
            a.a && Ef(a)
        }
        zf.prototype.then = function(a, b, c) {
            var d, e,
                f = new F(function(g, h) {
                    d = g;
                    e = h
                });
            Gf(this, d, function(g) {
                g instanceof Bf ? f.cancel() : e(g)
            });
            return f.then(a, b, c)
        };
        zf.prototype.$goog_Thenable = !0;

        function Hf(a) {
            return La(a.s, function(b) {
                return sa(b[1])
            })
        }

        function Ef(a) {
            if (a.i && a.a && Hf(a)) {
                var b = a.i,
                    c = If[b];
                c && (n.clearTimeout(c.a), delete If[b]);
                a.i = 0
            }
            a.g && (a.g.D--, delete a.g);
            b = a.h;
            for (var d = c = !1; a.s.length && !a.B;) {
                var e = a.s.shift(),
                    f = e[0],
                    g = e[1];
                e = e[2];
                if (f = a.j ? g : f) try {
                    var h = f.call(e || a.P, b);
                    ka(h) && (a.j = a.j && (h == b || h instanceof Error), a.h = b = h);
                    if (He(b) ||
                        "function" === typeof n.Promise && b instanceof n.Promise) d = !0, a.B = !0
                } catch (l) {
                    b = l, a.j = !0, Hf(a) || (c = !0)
                }
            }
            a.h = b;
            d && (h = t(a.M, a, !0), d = t(a.M, a, !1), b instanceof zf ? (Gf(b, h, d), b.l = !0) : b.then(h, d));
            c && (b = new Jf(b), If[b.a] = b, a.i = b.a)
        }

        function Ff() {
            Ba.call(this)
        }
        w(Ff, Ba);
        Ff.prototype.message = "Deferred has already fired";
        Ff.prototype.name = "AlreadyCalledError";

        function Bf() {
            Ba.call(this)
        }
        w(Bf, Ba);
        Bf.prototype.message = "Deferred was canceled";
        Bf.prototype.name = "CanceledError";

        function Jf(a) {
            this.a = n.setTimeout(t(this.h,
                this), 0);
            this.g = a
        }
        Jf.prototype.h = function() {
            delete If[this.a];
            throw this.g;
        };
        var If = {};

        function Kf(a) {
            var b = {},
                c = b.document || document,
                d = yc(a).toString(),
                e = document.createElement("SCRIPT"),
                f = {
                    sb: e,
                    tb: void 0
                },
                g = new zf(f),
                h = null,
                l = null != b.timeout ? b.timeout : 5E3;
            0 < l && (h = window.setTimeout(function() {
                Lf(e, !0);
                var p = new Mf(Nf, "Timeout reached for loading script " + d);
                Cf(g);
                Df(g, !1, p)
            }, l), f.tb = h);
            e.onload = e.onreadystatechange = function() {
                e.readyState && "loaded" != e.readyState && "complete" != e.readyState || (Lf(e,
                    b.wc || !1, h), g.callback(null))
            };
            e.onerror = function() {
                Lf(e, !0, h);
                var p = new Mf(Of, "Error while loading script " + d);
                Cf(g);
                Df(g, !1, p)
            };
            f = b.attributes || {};
            ib(f, {
                type: "text/javascript",
                charset: "UTF-8"
            });
            Yc(e, f);
            Pc(e, a);
            Pf(c).appendChild(e);
            return g
        }

        function Pf(a) {
            var b = (a || document).getElementsByTagName("HEAD");
            return b && 0 != b.length ? b[0] : a.documentElement
        }

        function Af() {
            if (this && this.sb) {
                var a = this.sb;
                a && "SCRIPT" == a.tagName && Lf(a, !0, this.tb)
            }
        }

        function Lf(a, b, c) {
            null != c && n.clearTimeout(c);
            a.onload = na;
            a.onerror =
                na;
            a.onreadystatechange = na;
            b && window.setTimeout(function() {
                ad(a)
            }, 0)
        }
        var Of = 0,
            Nf = 1;

        function Mf(a, b) {
            var c = "Jsloader error (code #" + a + ")";
            b && (c += ": " + b);
            Ba.call(this, c);
            this.code = a
        }
        w(Mf, Ba);

        function Qf() {
            return n.google && n.google.accounts && n.google.accounts.id || null
        }

        function Rf(a) {
            this.a = a || Qf();
            this.h = !1;
            this.g = null
        }
        Rf.prototype.cancel = function() {
            this.a && this.h && (this.g && this.g(null), this.a.cancel())
        };

        function Sf(a, b, c) {
            if (a.a && b) return function() {
                a.h = !0;
                return new F(function(e) {
                    a.g = e;
                    a.a.initialize({
                        client_id: b,
                        callback: e,
                        auto_select: !c
                    });
                    a.a.prompt()
                })
            }();
            if (b) {
                var d = Tf.Xa().load().then(function() {
                    a.a = Qf();
                    return Sf(a, b, c)
                }).ta(function() {
                    return null
                });
                return G(d)
            }
            return G(null)
        }
        oa(Rf);
        var Uf = new sc(tc, "https://accounts.google.com/gsi/client");

        function Tf() {
            this.a = null
        }
        Tf.prototype.load = function() {
            var a = this;
            if (this.a) return this.a;
            var b = zc(vc(Uf));
            return Qf() ? G() : this.a = wf().then(function() {
                if (!Qf()) return new F(function(c, d) {
                    var e = setTimeout(function() {
                        a.a = null;
                        d(Error("Network error!"))
                    }, 1E4);
                    n.onGoogleLibraryLoad =
                        function() {
                            clearTimeout(e);
                            c()
                        };
                    G(Kf(b)).then(function() {
                        Qf() && c()
                    }).ta(function(f) {
                        clearTimeout(e);
                        a.a = null;
                        d(f)
                    })
                })
            })
        };
        oa(Tf);

        function Vf(a, b) {
            this.a = a;
            this.g = b || function(c) {
                throw c;
            }
        }
        Vf.prototype.confirm = function(a) {
            return G(this.a.confirm(a)).ta(this.g)
        };

        function Wf(a, b, c) {
            this.reset(a, b, c, void 0, void 0)
        }
        Wf.prototype.a = null;
        var Xf = 0;
        Wf.prototype.reset = function(a, b, c, d, e) {
            "number" == typeof e || Xf++;
            this.h = d || za();
            this.j = a;
            this.s = b;
            this.g = c;
            delete this.a
        };

        function Yf(a) {
            this.s = a;
            this.a = this.h = this.j =
                this.g = null
        }

        function Zf(a, b) {
            this.name = a;
            this.value = b
        }
        Zf.prototype.toString = function() {
            return this.name
        };
        var $f = new Zf("SEVERE", 1E3),
            ag = new Zf("WARNING", 900),
            bg = new Zf("CONFIG", 700);

        function cg(a) {
            if (a.j) return a.j;
            if (a.g) return cg(a.g);
            Fa("Root logger has no level set.");
            return null
        }
        Yf.prototype.log = function(a, b, c) {
            if (a.value >= cg(this).value)
                for (sa(b) && (b = b()), a = new Wf(a, String(b), this.s), c && (a.a = c), c = this; c;) {
                    var d = c,
                        e = a;
                    if (d.a)
                        for (var f = 0; b = d.a[f]; f++) b(e);
                    c = c.g
                }
        };
        var dg = {},
            eg = null;

        function fg() {
            eg ||
                (eg = new Yf(""), dg[""] = eg, eg.j = bg)
        }

        function gg(a) {
            fg();
            var b;
            if (!(b = dg[a])) {
                b = new Yf(a);
                var c = a.lastIndexOf("."),
                    d = a.substr(c + 1);
                c = gg(a.substr(0, c));
                c.h || (c.h = {});
                c.h[d] = b;
                b.g = c;
                dg[a] = b
            }
            return b
        }

        function hg() {
            this.a = za()
        }
        var ig = null;
        hg.prototype.set = function(a) {
            this.a = a
        };
        hg.prototype.reset = function() {
            this.set(za())
        };
        hg.prototype.get = function() {
            return this.a
        };

        function jg(a) {
            this.j = a || "";
            ig || (ig = new hg);
            this.s = ig
        }
        jg.prototype.a = !0;
        jg.prototype.g = !0;
        jg.prototype.h = !1;

        function kg(a) {
            return 10 > a ? "0" + a :
                String(a)
        }

        function lg(a, b) {
            a = (a.h - b) / 1E3;
            b = a.toFixed(3);
            var c = 0;
            if (1 > a) c = 2;
            else
                for (; 100 > a;) c++, a *= 10;
            for (; 0 < c--;) b = " " + b;
            return b
        }

        function mg(a) {
            jg.call(this, a)
        }
        w(mg, jg);

        function ng(a, b) {
            var c = [];
            c.push(a.j, " ");
            if (a.g) {
                var d = new Date(b.h);
                c.push("[", kg(d.getFullYear() - 2E3) + kg(d.getMonth() + 1) + kg(d.getDate()) + " " + kg(d.getHours()) + ":" + kg(d.getMinutes()) + ":" + kg(d.getSeconds()) + "." + kg(Math.floor(d.getMilliseconds() / 10)), "] ")
            }
            c.push("[", lg(b, a.s.get()), "s] ");
            c.push("[", b.g, "] ");
            c.push(b.s);
            a.h && (b =
                b.a) && c.push("\n", b instanceof Error ? b.message : b.toString());
            a.a && c.push("\n");
            return c.join("")
        }

        function og() {
            this.s = t(this.h, this);
            this.a = new mg;
            this.a.g = !1;
            this.a.h = !1;
            this.g = this.a.a = !1;
            this.j = {}
        }
        og.prototype.h = function(a) {
            function b(f) {
                if (f) {
                    if (f.value >= $f.value) return "error";
                    if (f.value >= ag.value) return "warn";
                    if (f.value >= bg.value) return "log"
                }
                return "debug"
            }
            if (!this.j[a.g]) {
                var c = ng(this.a, a),
                    d = pg;
                if (d) {
                    var e = b(a.j);
                    qg(d, e, c, a.a)
                }
            }
        };
        var pg = n.console;

        function qg(a, b, c, d) {
            if (a[b]) a[b](c, d || "");
            else a.log(c,
                d || "")
        }

        function rg(a, b) {
            var c = sg;
            c && c.log($f, a, b)
        }
        var sg;
        sg = gg("firebaseui");
        var tg = new og;
        if (1 != tg.g) {
            var ug;
            fg();
            ug = eg;
            var vg = tg.s;
            ug.a || (ug.a = []);
            ug.a.push(vg);
            tg.g = !0
        }

        function wg(a) {
            var b = sg;
            b && b.log(ag, a, void 0)
        }

        function xg(a, b, c, d) {
            this.a = a;
            this.h = b || null;
            this.j = c || null;
            this.g = d || null
        }
        xg.prototype.aa = function() {
            return {
                email: this.a,
                displayName: this.h,
                photoUrl: this.j,
                providerId: this.g
            }
        };

        function yg(a) {
            return a.email ? new xg(a.email, a.displayName, a.photoUrl, a.providerId) : null
        }

        function zg() {
            this.a =
                ("undefined" == typeof document ? null : document) || {
                    cookie: ""
                }
        }
        k = zg.prototype;
        k.set = function(a, b, c, d, e, f) {
            if (/[;=\s]/.test(a)) throw Error('Invalid cookie name "' + a + '"');
            if (/[;\r\n]/.test(b)) throw Error('Invalid cookie value "' + b + '"');
            ka(c) || (c = -1);
            e = e ? ";domain=" + e : "";
            d = d ? ";path=" + d : "";
            f = f ? ";secure" : "";
            c = 0 > c ? "" : 0 == c ? ";expires=" + (new Date(1970, 1, 1)).toUTCString() : ";expires=" + (new Date(za() + 1E3 * c)).toUTCString();
            this.a.cookie = a + "=" + b + e + d + c + f
        };
        k.get = function(a, b) {
            for (var c = a + "=", d = (this.a.cookie || "").split(";"),
                    e = 0, f; e < d.length; e++) {
                f = Wa(d[e]);
                if (0 == f.lastIndexOf(c, 0)) return f.substr(c.length);
                if (f == a) return ""
            }
            return b
        };
        k.ja = function() {
            return Ag(this).keys
        };
        k.la = function() {
            return Ag(this).values
        };
        k.clear = function() {
            for (var a = Ag(this).keys, b = a.length - 1; 0 <= b; b--) {
                var c = a[b];
                this.get(c);
                this.set(c, "", 0, void 0, void 0)
            }
        };

        function Ag(a) {
            a = (a.a.cookie || "").split(";");
            for (var b = [], c = [], d, e, f = 0; f < a.length; f++) e = Wa(a[f]), d = e.indexOf("="), -1 == d ? (b.push(""), c.push(e)) : (b.push(e.substring(0, d)), c.push(e.substring(d +
                1)));
            return {
                keys: b,
                values: c
            }
        }
        var Bg = new zg;

        function Cg() {}

        function Dg(a, b, c, d) {
            this.h = "undefined" !== typeof a && null !== a ? a : -1;
            this.g = b || null;
            this.a = c || null;
            this.j = !!d
        }
        m(Dg, Cg);
        Dg.prototype.set = function(a, b) {
            Bg.set(a, b, this.h, this.g, this.a, this.j)
        };
        Dg.prototype.get = function(a) {
            return Bg.get(a) || null
        };
        Dg.prototype.ra = function(a) {
            var b = this.g,
                c = this.a;
            Bg.get(a);
            Bg.set(a, "", 0, b, c)
        };

        function Eg(a, b) {
            this.g = a;
            this.a = b || null
        }
        Eg.prototype.aa = function() {
            return {
                email: this.g,
                credential: this.a && this.a.toJSON()
            }
        };

        function Fg(a) {
            if (a && a.email) {
                var b = a.credential && firebase.auth.AuthCredential.fromJSON(a.credential);
                return new Eg(a.email, b)
            }
            return null
        }

        function Gg(a) {
            this.a = a || null
        }
        Gg.prototype.aa = function() {
            return {
                tenantId: this.a
            }
        };

        function Hg(a) {
            for (var b = [], c = 0, d = 0; d < a.length; d++) {
                var e = a.charCodeAt(d);
                255 < e && (b[c++] = e & 255, e >>= 8);
                b[c++] = e
            }
            return b
        }

        function Ig(a) {
            return Ka(a, function(b) {
                b = b.toString(16);
                return 1 < b.length ? b : "0" + b
            }).join("")
        }

        function Jg(a) {
            this.i = a;
            this.g = this.i.length / 4;
            this.j = this.g + 6;
            this.h = [
                [],
                [],
                [],
                []
            ];
            this.s = [
                [],
                [],
                [],
                []
            ];
            this.a = Array(Lg * (this.j + 1));
            for (a = 0; a < this.g; a++) this.a[a] = [this.i[4 * a], this.i[4 * a + 1], this.i[4 * a + 2], this.i[4 * a + 3]];
            var b = Array(4);
            for (a = this.g; a < Lg * (this.j + 1); a++) {
                b[0] = this.a[a - 1][0];
                b[1] = this.a[a - 1][1];
                b[2] = this.a[a - 1][2];
                b[3] = this.a[a - 1][3];
                if (0 == a % this.g) {
                    var c = b,
                        d = c[0];
                    c[0] = c[1];
                    c[1] = c[2];
                    c[2] = c[3];
                    c[3] = d;
                    Mg(b);
                    b[0] ^= Ng[a / this.g][0];
                    b[1] ^= Ng[a / this.g][1];
                    b[2] ^= Ng[a / this.g][2];
                    b[3] ^= Ng[a / this.g][3]
                } else 6 < this.g && 4 == a % this.g && Mg(b);
                this.a[a] = Array(4);
                this.a[a][0] =
                    this.a[a - this.g][0] ^ b[0];
                this.a[a][1] = this.a[a - this.g][1] ^ b[1];
                this.a[a][2] = this.a[a - this.g][2] ^ b[2];
                this.a[a][3] = this.a[a - this.g][3] ^ b[3]
            }
        }
        Jg.prototype.B = 16;
        var Lg = Jg.prototype.B / 4;

        function Og(a, b) {
            for (var c, d = 0; d < Lg; d++)
                for (var e = 0; 4 > e; e++) c = 4 * e + d, c = b[c], a.h[d][e] = c
        }

        function Pg(a) {
            for (var b = [], c = 0; c < Lg; c++)
                for (var d = 0; 4 > d; d++) b[4 * d + c] = a.h[c][d];
            return b
        }

        function Qg(a, b) {
            for (var c = 0; 4 > c; c++)
                for (var d = 0; 4 > d; d++) a.h[c][d] ^= a.a[4 * b + d][c]
        }

        function Rg(a, b) {
            for (var c = 0; 4 > c; c++)
                for (var d = 0; 4 > d; d++) a.h[c][d] =
                    b[a.h[c][d]]
        }

        function Sg(a) {
            for (var b = 1; 4 > b; b++)
                for (var c = 0; 4 > c; c++) a.s[b][c] = a.h[b][c];
            for (b = 1; 4 > b; b++)
                for (c = 0; 4 > c; c++) a.h[b][c] = a.s[b][(c + b) % Lg]
        }

        function Tg(a) {
            for (var b = 1; 4 > b; b++)
                for (var c = 0; 4 > c; c++) a.s[b][(c + b) % Lg] = a.h[b][c];
            for (b = 1; 4 > b; b++)
                for (c = 0; 4 > c; c++) a.h[b][c] = a.s[b][c]
        }

        function Mg(a) {
            a[0] = Ug[a[0]];
            a[1] = Ug[a[1]];
            a[2] = Ug[a[2]];
            a[3] = Ug[a[3]]
        }
        var Ug = [99, 124, 119, 123, 242, 107, 111, 197, 48, 1, 103, 43, 254, 215, 171, 118, 202, 130, 201, 125, 250, 89, 71, 240, 173, 212, 162, 175, 156, 164, 114, 192, 183, 253, 147, 38, 54, 63,
                247, 204, 52, 165, 229, 241, 113, 216, 49, 21, 4, 199, 35, 195, 24, 150, 5, 154, 7, 18, 128, 226, 235, 39, 178, 117, 9, 131, 44, 26, 27, 110, 90, 160, 82, 59, 214, 179, 41, 227, 47, 132, 83, 209, 0, 237, 32, 252, 177, 91, 106, 203, 190, 57, 74, 76, 88, 207, 208, 239, 170, 251, 67, 77, 51, 133, 69, 249, 2, 127, 80, 60, 159, 168, 81, 163, 64, 143, 146, 157, 56, 245, 188, 182, 218, 33, 16, 255, 243, 210, 205, 12, 19, 236, 95, 151, 68, 23, 196, 167, 126, 61, 100, 93, 25, 115, 96, 129, 79, 220, 34, 42, 144, 136, 70, 238, 184, 20, 222, 94, 11, 219, 224, 50, 58, 10, 73, 6, 36, 92, 194, 211, 172, 98, 145, 149, 228, 121, 231, 200, 55, 109, 141,
                213, 78, 169, 108, 86, 244, 234, 101, 122, 174, 8, 186, 120, 37, 46, 28, 166, 180, 198, 232, 221, 116, 31, 75, 189, 139, 138, 112, 62, 181, 102, 72, 3, 246, 14, 97, 53, 87, 185, 134, 193, 29, 158, 225, 248, 152, 17, 105, 217, 142, 148, 155, 30, 135, 233, 206, 85, 40, 223, 140, 161, 137, 13, 191, 230, 66, 104, 65, 153, 45, 15, 176, 84, 187, 22
            ],
            Vg = [82, 9, 106, 213, 48, 54, 165, 56, 191, 64, 163, 158, 129, 243, 215, 251, 124, 227, 57, 130, 155, 47, 255, 135, 52, 142, 67, 68, 196, 222, 233, 203, 84, 123, 148, 50, 166, 194, 35, 61, 238, 76, 149, 11, 66, 250, 195, 78, 8, 46, 161, 102, 40, 217, 36, 178, 118, 91, 162, 73, 109, 139, 209,
                37, 114, 248, 246, 100, 134, 104, 152, 22, 212, 164, 92, 204, 93, 101, 182, 146, 108, 112, 72, 80, 253, 237, 185, 218, 94, 21, 70, 87, 167, 141, 157, 132, 144, 216, 171, 0, 140, 188, 211, 10, 247, 228, 88, 5, 184, 179, 69, 6, 208, 44, 30, 143, 202, 63, 15, 2, 193, 175, 189, 3, 1, 19, 138, 107, 58, 145, 17, 65, 79, 103, 220, 234, 151, 242, 207, 206, 240, 180, 230, 115, 150, 172, 116, 34, 231, 173, 53, 133, 226, 249, 55, 232, 28, 117, 223, 110, 71, 241, 26, 113, 29, 41, 197, 137, 111, 183, 98, 14, 170, 24, 190, 27, 252, 86, 62, 75, 198, 210, 121, 32, 154, 219, 192, 254, 120, 205, 90, 244, 31, 221, 168, 51, 136, 7, 199, 49, 177, 18, 16,
                89, 39, 128, 236, 95, 96, 81, 127, 169, 25, 181, 74, 13, 45, 229, 122, 159, 147, 201, 156, 239, 160, 224, 59, 77, 174, 42, 245, 176, 200, 235, 187, 60, 131, 83, 153, 97, 23, 43, 4, 126, 186, 119, 214, 38, 225, 105, 20, 99, 85, 33, 12, 125
            ],
            Ng = [
                [0, 0, 0, 0],
                [1, 0, 0, 0],
                [2, 0, 0, 0],
                [4, 0, 0, 0],
                [8, 0, 0, 0],
                [16, 0, 0, 0],
                [32, 0, 0, 0],
                [64, 0, 0, 0],
                [128, 0, 0, 0],
                [27, 0, 0, 0],
                [54, 0, 0, 0]
            ],
            Wg = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120,
                122, 124, 126, 128, 130, 132, 134, 136, 138, 140, 142, 144, 146, 148, 150, 152, 154, 156, 158, 160, 162, 164, 166, 168, 170, 172, 174, 176, 178, 180, 182, 184, 186, 188, 190, 192, 194, 196, 198, 200, 202, 204, 206, 208, 210, 212, 214, 216, 218, 220, 222, 224, 226, 228, 230, 232, 234, 236, 238, 240, 242, 244, 246, 248, 250, 252, 254, 27, 25, 31, 29, 19, 17, 23, 21, 11, 9, 15, 13, 3, 1, 7, 5, 59, 57, 63, 61, 51, 49, 55, 53, 43, 41, 47, 45, 35, 33, 39, 37, 91, 89, 95, 93, 83, 81, 87, 85, 75, 73, 79, 77, 67, 65, 71, 69, 123, 121, 127, 125, 115, 113, 119, 117, 107, 105, 111, 109, 99, 97, 103, 101, 155, 153, 159, 157, 147, 145, 151, 149,
                139, 137, 143, 141, 131, 129, 135, 133, 187, 185, 191, 189, 179, 177, 183, 181, 171, 169, 175, 173, 163, 161, 167, 165, 219, 217, 223, 221, 211, 209, 215, 213, 203, 201, 207, 205, 195, 193, 199, 197, 251, 249, 255, 253, 243, 241, 247, 245, 235, 233, 239, 237, 227, 225, 231, 229
            ],
            Xg = [0, 3, 6, 5, 12, 15, 10, 9, 24, 27, 30, 29, 20, 23, 18, 17, 48, 51, 54, 53, 60, 63, 58, 57, 40, 43, 46, 45, 36, 39, 34, 33, 96, 99, 102, 101, 108, 111, 106, 105, 120, 123, 126, 125, 116, 119, 114, 113, 80, 83, 86, 85, 92, 95, 90, 89, 72, 75, 78, 77, 68, 71, 66, 65, 192, 195, 198, 197, 204, 207, 202, 201, 216, 219, 222, 221, 212, 215, 210, 209, 240, 243,
                246, 245, 252, 255, 250, 249, 232, 235, 238, 237, 228, 231, 226, 225, 160, 163, 166, 165, 172, 175, 170, 169, 184, 187, 190, 189, 180, 183, 178, 177, 144, 147, 150, 149, 156, 159, 154, 153, 136, 139, 142, 141, 132, 135, 130, 129, 155, 152, 157, 158, 151, 148, 145, 146, 131, 128, 133, 134, 143, 140, 137, 138, 171, 168, 173, 174, 167, 164, 161, 162, 179, 176, 181, 182, 191, 188, 185, 186, 251, 248, 253, 254, 247, 244, 241, 242, 227, 224, 229, 230, 239, 236, 233, 234, 203, 200, 205, 206, 199, 196, 193, 194, 211, 208, 213, 214, 223, 220, 217, 218, 91, 88, 93, 94, 87, 84, 81, 82, 67, 64, 69, 70, 79, 76, 73, 74, 107, 104, 109, 110,
                103, 100, 97, 98, 115, 112, 117, 118, 127, 124, 121, 122, 59, 56, 61, 62, 55, 52, 49, 50, 35, 32, 37, 38, 47, 44, 41, 42, 11, 8, 13, 14, 7, 4, 1, 2, 19, 16, 21, 22, 31, 28, 25, 26
            ],
            Yg = [0, 9, 18, 27, 36, 45, 54, 63, 72, 65, 90, 83, 108, 101, 126, 119, 144, 153, 130, 139, 180, 189, 166, 175, 216, 209, 202, 195, 252, 245, 238, 231, 59, 50, 41, 32, 31, 22, 13, 4, 115, 122, 97, 104, 87, 94, 69, 76, 171, 162, 185, 176, 143, 134, 157, 148, 227, 234, 241, 248, 199, 206, 213, 220, 118, 127, 100, 109, 82, 91, 64, 73, 62, 55, 44, 37, 26, 19, 8, 1, 230, 239, 244, 253, 194, 203, 208, 217, 174, 167, 188, 181, 138, 131, 152, 145, 77, 68, 95, 86, 105, 96,
                123, 114, 5, 12, 23, 30, 33, 40, 51, 58, 221, 212, 207, 198, 249, 240, 235, 226, 149, 156, 135, 142, 177, 184, 163, 170, 236, 229, 254, 247, 200, 193, 218, 211, 164, 173, 182, 191, 128, 137, 146, 155, 124, 117, 110, 103, 88, 81, 74, 67, 52, 61, 38, 47, 16, 25, 2, 11, 215, 222, 197, 204, 243, 250, 225, 232, 159, 150, 141, 132, 187, 178, 169, 160, 71, 78, 85, 92, 99, 106, 113, 120, 15, 6, 29, 20, 43, 34, 57, 48, 154, 147, 136, 129, 190, 183, 172, 165, 210, 219, 192, 201, 246, 255, 228, 237, 10, 3, 24, 17, 46, 39, 60, 53, 66, 75, 80, 89, 102, 111, 116, 125, 161, 168, 179, 186, 133, 140, 151, 158, 233, 224, 251, 242, 205, 196, 223, 214,
                49, 56, 35, 42, 21, 28, 7, 14, 121, 112, 107, 98, 93, 84, 79, 70
            ],
            Zg = [0, 11, 22, 29, 44, 39, 58, 49, 88, 83, 78, 69, 116, 127, 98, 105, 176, 187, 166, 173, 156, 151, 138, 129, 232, 227, 254, 245, 196, 207, 210, 217, 123, 112, 109, 102, 87, 92, 65, 74, 35, 40, 53, 62, 15, 4, 25, 18, 203, 192, 221, 214, 231, 236, 241, 250, 147, 152, 133, 142, 191, 180, 169, 162, 246, 253, 224, 235, 218, 209, 204, 199, 174, 165, 184, 179, 130, 137, 148, 159, 70, 77, 80, 91, 106, 97, 124, 119, 30, 21, 8, 3, 50, 57, 36, 47, 141, 134, 155, 144, 161, 170, 183, 188, 213, 222, 195, 200, 249, 242, 239, 228, 61, 54, 43, 32, 17, 26, 7, 12, 101, 110, 115, 120, 73,
                66, 95, 84, 247, 252, 225, 234, 219, 208, 205, 198, 175, 164, 185, 178, 131, 136, 149, 158, 71, 76, 81, 90, 107, 96, 125, 118, 31, 20, 9, 2, 51, 56, 37, 46, 140, 135, 154, 145, 160, 171, 182, 189, 212, 223, 194, 201, 248, 243, 238, 229, 60, 55, 42, 33, 16, 27, 6, 13, 100, 111, 114, 121, 72, 67, 94, 85, 1, 10, 23, 28, 45, 38, 59, 48, 89, 82, 79, 68, 117, 126, 99, 104, 177, 186, 167, 172, 157, 150, 139, 128, 233, 226, 255, 244, 197, 206, 211, 216, 122, 113, 108, 103, 86, 93, 64, 75, 34, 41, 52, 63, 14, 5, 24, 19, 202, 193, 220, 215, 230, 237, 240, 251, 146, 153, 132, 143, 190, 181, 168, 163
            ],
            $g = [0, 13, 26, 23, 52, 57, 46, 35, 104, 101,
                114, 127, 92, 81, 70, 75, 208, 221, 202, 199, 228, 233, 254, 243, 184, 181, 162, 175, 140, 129, 150, 155, 187, 182, 161, 172, 143, 130, 149, 152, 211, 222, 201, 196, 231, 234, 253, 240, 107, 102, 113, 124, 95, 82, 69, 72, 3, 14, 25, 20, 55, 58, 45, 32, 109, 96, 119, 122, 89, 84, 67, 78, 5, 8, 31, 18, 49, 60, 43, 38, 189, 176, 167, 170, 137, 132, 147, 158, 213, 216, 207, 194, 225, 236, 251, 246, 214, 219, 204, 193, 226, 239, 248, 245, 190, 179, 164, 169, 138, 135, 144, 157, 6, 11, 28, 17, 50, 63, 40, 37, 110, 99, 116, 121, 90, 87, 64, 77, 218, 215, 192, 205, 238, 227, 244, 249, 178, 191, 168, 165, 134, 139, 156, 145, 10, 7, 16, 29,
                62, 51, 36, 41, 98, 111, 120, 117, 86, 91, 76, 65, 97, 108, 123, 118, 85, 88, 79, 66, 9, 4, 19, 30, 61, 48, 39, 42, 177, 188, 171, 166, 133, 136, 159, 146, 217, 212, 195, 206, 237, 224, 247, 250, 183, 186, 173, 160, 131, 142, 153, 148, 223, 210, 197, 200, 235, 230, 241, 252, 103, 106, 125, 112, 83, 94, 73, 68, 15, 2, 21, 24, 59, 54, 33, 44, 12, 1, 22, 27, 56, 53, 34, 47, 100, 105, 126, 115, 80, 93, 74, 71, 220, 209, 198, 203, 232, 229, 242, 255, 180, 185, 174, 163, 128, 141, 154, 151
            ],
            ah = [0, 14, 28, 18, 56, 54, 36, 42, 112, 126, 108, 98, 72, 70, 84, 90, 224, 238, 252, 242, 216, 214, 196, 202, 144, 158, 140, 130, 168, 166, 180, 186,
                219, 213, 199, 201, 227, 237, 255, 241, 171, 165, 183, 185, 147, 157, 143, 129, 59, 53, 39, 41, 3, 13, 31, 17, 75, 69, 87, 89, 115, 125, 111, 97, 173, 163, 177, 191, 149, 155, 137, 135, 221, 211, 193, 207, 229, 235, 249, 247, 77, 67, 81, 95, 117, 123, 105, 103, 61, 51, 33, 47, 5, 11, 25, 23, 118, 120, 106, 100, 78, 64, 82, 92, 6, 8, 26, 20, 62, 48, 34, 44, 150, 152, 138, 132, 174, 160, 178, 188, 230, 232, 250, 244, 222, 208, 194, 204, 65, 79, 93, 83, 121, 119, 101, 107, 49, 63, 45, 35, 9, 7, 21, 27, 161, 175, 189, 179, 153, 151, 133, 139, 209, 223, 205, 195, 233, 231, 245, 251, 154, 148, 134, 136, 162, 172, 190, 176, 234, 228, 246,
                248, 210, 220, 206, 192, 122, 116, 102, 104, 66, 76, 94, 80, 10, 4, 22, 24, 50, 60, 46, 32, 236, 226, 240, 254, 212, 218, 200, 198, 156, 146, 128, 142, 164, 170, 184, 182, 12, 2, 16, 30, 52, 58, 40, 38, 124, 114, 96, 110, 68, 74, 88, 86, 55, 57, 43, 37, 15, 1, 19, 29, 71, 73, 91, 85, 127, 113, 99, 109, 215, 217, 203, 197, 239, 225, 243, 253, 167, 169, 187, 181, 159, 145, 131, 141
            ];

        function bh(a, b) {
            a = new Jg(ch(a));
            b = Hg(b);
            for (var c = Ua(b, 0, 16), d = "", e; c.length;) {
                e = 16 - c.length;
                for (var f = 0; f < e; f++) c.push(0);
                e = a;
                Og(e, c);
                Qg(e, 0);
                for (c = 1; c < e.j; ++c) {
                    Rg(e, Ug);
                    Sg(e);
                    f = e.h;
                    for (var g = e.s[0],
                            h = 0; 4 > h; h++) g[0] = f[0][h], g[1] = f[1][h], g[2] = f[2][h], g[3] = f[3][h], f[0][h] = Wg[g[0]] ^ Xg[g[1]] ^ g[2] ^ g[3], f[1][h] = g[0] ^ Wg[g[1]] ^ Xg[g[2]] ^ g[3], f[2][h] = g[0] ^ g[1] ^ Wg[g[2]] ^ Xg[g[3]], f[3][h] = Xg[g[0]] ^ g[1] ^ g[2] ^ Wg[g[3]];
                    Qg(e, c)
                }
                Rg(e, Ug);
                Sg(e);
                Qg(e, e.j);
                d += Ig(Pg(e));
                c = Ua(b, 0, 16)
            }
            return d
        }

        function dh(a, b) {
            a = new Jg(ch(a));
            for (var c = [], d = 0; d < b.length; d += 2) c.push(parseInt(b.substring(d, d + 2), 16));
            var e = Ua(c, 0, 16);
            for (b = ""; e.length;) {
                d = a;
                Og(d, e);
                Qg(d, d.j);
                for (e = 1; e < d.j; ++e) {
                    Tg(d);
                    Rg(d, Vg);
                    Qg(d, d.j - e);
                    for (var f = d.h,
                            g = d.s[0], h = 0; 4 > h; h++) g[0] = f[0][h], g[1] = f[1][h], g[2] = f[2][h], g[3] = f[3][h], f[0][h] = ah[g[0]] ^ Zg[g[1]] ^ $g[g[2]] ^ Yg[g[3]], f[1][h] = Yg[g[0]] ^ ah[g[1]] ^ Zg[g[2]] ^ $g[g[3]], f[2][h] = $g[g[0]] ^ Yg[g[1]] ^ ah[g[2]] ^ Zg[g[3]], f[3][h] = Zg[g[0]] ^ $g[g[1]] ^ Yg[g[2]] ^ ah[g[3]]
                }
                Tg(d);
                Rg(d, Vg);
                Qg(d, 0);
                d = Pg(d);
                if (8192 >= d.length) d = String.fromCharCode.apply(null, d);
                else {
                    e = "";
                    for (f = 0; f < d.length; f += 8192) e += String.fromCharCode.apply(null, Va(d, f, f + 8192));
                    d = e
                }
                b += d;
                e = Ua(c, 0, 16)
            }
            return b.replace(/(\x00)+$/, "")
        }

        function ch(a) {
            a = Hg(a.substring(0,
                32));
            for (var b = 32 - a.length, c = 0; c < b; c++) a.push(0);
            return a
        }

        function eh(a) {
            var b = [];
            fh(new gh, a, b);
            return b.join("")
        }

        function gh() {}

        function fh(a, b, c) {
            if (null == b) c.push("null");
            else {
                if ("object" == typeof b) {
                    if (qa(b)) {
                        var d = b;
                        b = d.length;
                        c.push("[");
                        for (var e = "", f = 0; f < b; f++) c.push(e), fh(a, d[f], c), e = ",";
                        c.push("]");
                        return
                    }
                    if (b instanceof String || b instanceof Number || b instanceof Boolean) b = b.valueOf();
                    else {
                        c.push("{");
                        e = "";
                        for (d in b) Object.prototype.hasOwnProperty.call(b, d) && (f = b[d], "function" != typeof f &&
                            (c.push(e), hh(d, c), c.push(":"), fh(a, f, c), e = ","));
                        c.push("}");
                        return
                    }
                }
                switch (typeof b) {
                    case "string":
                        hh(b, c);
                        break;
                    case "number":
                        c.push(isFinite(b) && !isNaN(b) ? String(b) : "null");
                        break;
                    case "boolean":
                        c.push(String(b));
                        break;
                    case "function":
                        c.push("null");
                        break;
                    default:
                        throw Error("Unknown type: " + typeof b);
                }
            }
        }
        var ih = {
                '"': '\\"',
                "\\": "\\\\",
                "/": "\\/",
                "\b": "\\b",
                "\f": "\\f",
                "\n": "\\n",
                "\r": "\\r",
                "\t": "\\t",
                "\x0B": "\\u000b"
            },
            jh = /\uffff/.test("\uffff") ? /[\\"\x00-\x1f\x7f-\uffff]/g : /[\\"\x00-\x1f\x7f-\xff]/g;

        function hh(a, b) {
            b.push('"', a.replace(jh, function(c) {
                var d = ih[c];
                d || (d = "\\u" + (c.charCodeAt(0) | 65536).toString(16).substr(1), ih[c] = d);
                return d
            }), '"')
        }

        function kh(a) {
            this.a = a
        }
        kh.prototype.set = function(a, b) {
            ka(b) ? this.a.set(a, eh(b)) : this.a.ra(a)
        };
        kh.prototype.get = function(a) {
            try {
                var b = this.a.get(a)
            } catch (c) {
                return
            }
            if (null !== b) try {
                return JSON.parse(b)
            } catch (c$3) {
                throw "Storage: Invalid value was encountered";
            }
        };

        function lh() {}
        w(lh, Cg);
        lh.prototype.clear = function() {
            var a = nb(this.ha(!0)),
                b = this;
            Ha(a, function(c) {
                b.ra(c)
            })
        };

        function mh(a) {
            this.a = a
        }
        w(mh, lh);

        function nh(a) {
            if (!a.a) return !1;
            try {
                return a.a.setItem("__sak", "1"), a.a.removeItem("__sak"), !0
            } catch (b) {
                return !1
            }
        }
        k = mh.prototype;
        k.set = function(a, b) {
            try {
                this.a.setItem(a, b)
            } catch (c) {
                if (0 == this.a.length) throw "Storage mechanism: Storage disabled";
                throw "Storage mechanism: Quota exceeded";
            }
        };
        k.get = function(a) {
            a = this.a.getItem(a);
            if (!q(a) && null !== a) throw "Storage mechanism: Invalid value was encountered";
            return a
        };
        k.ra = function(a) {
            this.a.removeItem(a)
        };
        k.ha = function(a) {
            var b =
                0,
                c = this.a,
                d = new kb;
            d.next = function() {
                if (b >= c.length) throw jb;
                var e = c.key(b++);
                if (a) return e;
                e = c.getItem(e);
                if (!q(e)) throw "Storage mechanism: Invalid value was encountered";
                return e
            };
            return d
        };
        k.clear = function() {
            this.a.clear()
        };
        k.key = function(a) {
            return this.a.key(a)
        };

        function oh() {
            var a = null;
            try {
                a = window.localStorage || null
            } catch (b) {}
            this.a = a
        }
        w(oh, mh);

        function ph() {
            var a = null;
            try {
                a = window.sessionStorage || null
            } catch (b) {}
            this.a = a
        }
        w(ph, mh);

        function qh(a, b) {
            this.g = a;
            this.a = b + "::"
        }
        w(qh, lh);
        qh.prototype.set =
            function(a, b) {
                this.g.set(this.a + a, b)
            };
        qh.prototype.get = function(a) {
            return this.g.get(this.a + a)
        };
        qh.prototype.ra = function(a) {
            this.g.ra(this.a + a)
        };
        qh.prototype.ha = function(a) {
            var b = this.g.ha(!0),
                c = this,
                d = new kb;
            d.next = function() {
                for (var e = b.next(); e.substr(0, c.a.length) != c.a;) e = b.next();
                return a ? e.substr(c.a.length) : c.g.get(e)
            };
            return d
        };
        var rh, sh = new oh;
        rh = nh(sh) ? new qh(sh, "firebaseui") : null;
        var th = new kh(rh),
            uh, vh = new ph;
        uh = nh(vh) ? new qh(vh, "firebaseui") : null;
        var wh = new kh(uh),
            xh = {
                name: "pendingEmailCredential",
                storage: wh
            },
            yh = {
                name: "redirectStatus",
                storage: wh
            },
            zh = {
                name: "redirectUrl",
                storage: wh
            },
            Ah = {
                name: "rememberAccount",
                storage: wh
            },
            Bh = {
                name: "rememberedAccounts",
                storage: th
            },
            Ch = {
                name: "emailForSignIn",
                storage: new kh(new Dg(3600, "/"))
            },
            Dh = {
                name: "pendingEncryptedCredential",
                storage: new kh(new Dg(3600, "/"))
            };

        function Eh(a, b) {
            return a.storage.get(b ? a.name + ":" + b : a.name)
        }

        function Fh(a, b) {
            a.storage.a.ra(b ? a.name + ":" + b : a.name)
        }

        function Gh(a, b, c) {
            a.storage.set(c ? a.name + ":" + c : a.name, b)
        }

        function Hh(a) {
            return Eh(zh, a) ||
                null
        }

        function Ih(a, b) {
            Gh(zh, a, b)
        }

        function Jh(a, b) {
            Gh(Ah, a, b)
        }

        function Kh(a) {
            a = Eh(Bh, a) || [];
            a = Ka(a, function(b) {
                return yg(b)
            });
            return Ja(a, function(b) {
                return null != b
            })
        }

        function Lh(a, b) {
            var c = Kh(b),
                d = Ma(c, function(e) {
                    return e.a == a.a && (e.g || null) == (a.g || null)
                }); - 1 < d && Pa(c, d);
            c.unshift(a);
            Gh(Bh, Ka(c, function(e) {
                return e.aa()
            }), b)
        }

        function Mh(a) {
            a = Eh(xh, a) || null;
            return Fg(a)
        }

        function Nh(a) {
            Fh(xh, a)
        }

        function Oh(a, b) {
            Gh(xh, a.aa(), b)
        }

        function Ph(a) {
            return (a = Eh(yh, a) || null) && "undefined" !== typeof a.tenantId ?
                new Gg(a.tenantId) : null
        }

        function Qh(a, b) {
            Gh(yh, a.aa(), b)
        }

        function Rh(a, b) {
            b = Eh(Ch, b);
            var c = null;
            if (b) try {
                var d = dh(a, b),
                    e = JSON.parse(d);
                c = e && e.email || null
            } catch (f) {}
            return c
        }

        function Sh(a, b) {
            b = Eh(Dh, b);
            var c = null;
            if (b) try {
                var d = dh(a, b);
                c = JSON.parse(d)
            } catch (e) {}
            return Fg(c || null)
        }

        function Th(a, b, c) {
            Gh(Dh, bh(a, JSON.stringify(b.aa())), c)
        }

        function Uh() {
            this.V = {}
        }

        function H(a, b, c) {
            if (b.toLowerCase() in a.V) throw Error("Configuration " + b + " has already been defined.");
            a.V[b.toLowerCase()] = c
        }

        function Vh(a,
            b, c) {
            if (!(b.toLowerCase() in a.V)) throw Error("Configuration " + b + " is not defined.");
            a.V[b.toLowerCase()] = c
        }
        Uh.prototype.get = function(a) {
            if (!(a.toLowerCase() in this.V)) throw Error("Configuration " + a + " is not defined.");
            return this.V[a.toLowerCase()]
        };

        function Wh(a, b) {
            a = a.get(b);
            if (!a) throw Error("Configuration " + b + " is required.");
            return a
        }

        function Xh() {
            this.g = void 0;
            this.a = {}
        }
        k = Xh.prototype;
        k.set = function(a, b) {
            Yh(this, a, b, !1)
        };
        k.add = function(a, b) {
            Yh(this, a, b, !0)
        };

        function Yh(a, b, c, d) {
            for (var e = 0; e <
                b.length; e++) {
                var f = b.charAt(e);
                a.a[f] || (a.a[f] = new Xh);
                a = a.a[f]
            }
            if (d && void 0 !== a.g) throw Error('The collection already contains the key "' + b + '"');
            a.g = c
        }
        k.get = function(a) {
            a: {
                for (var b = this, c = 0; c < a.length; c++)
                    if (b = b.a[a.charAt(c)], !b) {
                        a = void 0;
                        break a
                    } a = b
            }
            return a ? a.g : void 0
        };
        k.la = function() {
            var a = [];
            Zh(this, a);
            return a
        };

        function Zh(a, b) {
            void 0 !== a.g && b.push(a.g);
            for (var c in a.a) Zh(a.a[c], b)
        }
        k.ja = function() {
            var a = [];
            $h(this, "", a);
            return a
        };

        function $h(a, b, c) {
            void 0 !== a.g && c.push(b);
            for (var d in a.a) $h(a.a[d],
                b + d, c)
        }
        k.clear = function() {
            this.a = {};
            this.g = void 0
        };

        function ai(a) {
            this.a = a;
            this.g = new Xh;
            for (a = 0; a < this.a.length; a++) {
                var b = this.g.get("+" + this.a[a].b);
                b ? b.push(this.a[a]) : this.g.add("+" + this.a[a].b, [this.a[a]])
            }
        }

        function bi(a, b) {
            a = a.g;
            var c = {},
                d = 0;
            void 0 !== a.g && (c[d] = a.g);
            for (; d < b.length; d++) {
                var e = b.charAt(d);
                if (!(e in a.a)) break;
                a = a.a[e];
                void 0 !== a.g && (c[d] = a.g)
            }
            for (var f in c)
                if (c.hasOwnProperty(f)) return c[f];
            return []
        }

        function ci(a) {
            for (var b = 0; b < di.length; b++)
                if (di[b].c === a) return di[b];
            return null
        }

        function ei(a) {
            a = a.toUpperCase();
            for (var b = [], c = 0; c < di.length; c++) di[c].f === a && b.push(di[c]);
            return b
        }

        function fi(a) {
            if (0 < a.length && "+" == a.charAt(0)) {
                a = a.substring(1);
                for (var b = [], c = 0; c < di.length; c++) di[c].b == a && b.push(di[c]);
                a = b
            } else a = ei(a);
            return a
        }

        function gi(a) {
            a.sort(function(b, c) {
                return b.name.localeCompare(c.name, "en")
            })
        }
        var di = [{
            name: "Afghanistan",
            c: "93-AF-0",
            b: "93",
            f: "AF"
        }, {
            name: "\u00c5land Islands",
            c: "358-AX-0",
            b: "358",
            f: "AX"
        }, {
            name: "Albania",
            c: "355-AL-0",
            b: "355",
            f: "AL"
        }, {
            name: "Algeria",
            c: "213-DZ-0",
            b: "213",
            f: "DZ"
        }, {
            name: "American Samoa",
            c: "1-AS-0",
            b: "1",
            f: "AS"
        }, {
            name: "Andorra",
            c: "376-AD-0",
            b: "376",
            f: "AD"
        }, {
            name: "Angola",
            c: "244-AO-0",
            b: "244",
            f: "AO"
        }, {
            name: "Anguilla",
            c: "1-AI-0",
            b: "1",
            f: "AI"
        }, {
            name: "Antigua and Barbuda",
            c: "1-AG-0",
            b: "1",
            f: "AG"
        }, {
            name: "Argentina",
            c: "54-AR-0",
            b: "54",
            f: "AR"
        }, {
            name: "Armenia",
            c: "374-AM-0",
            b: "374",
            f: "AM"
        }, {
            name: "Aruba",
            c: "297-AW-0",
            b: "297",
            f: "AW"
        }, {
            name: "Ascension Island",
            c: "247-AC-0",
            b: "247",
            f: "AC"
        }, {
            name: "Australia",
            c: "61-AU-0",
            b: "61",
            f: "AU"
        }, {
            name: "Austria",
            c: "43-AT-0",
            b: "43",
            f: "AT"
        }, {
            name: "Azerbaijan",
            c: "994-AZ-0",
            b: "994",
            f: "AZ"
        }, {
            name: "Bahamas",
            c: "1-BS-0",
            b: "1",
            f: "BS"
        }, {
            name: "Bahrain",
            c: "973-BH-0",
            b: "973",
            f: "BH"
        }, {
            name: "Bangladesh",
            c: "880-BD-0",
            b: "880",
            f: "BD"
        }, {
            name: "Barbados",
            c: "1-BB-0",
            b: "1",
            f: "BB"
        }, {
            name: "Belarus",
            c: "375-BY-0",
            b: "375",
            f: "BY"
        }, {
            name: "Belgium",
            c: "32-BE-0",
            b: "32",
            f: "BE"
        }, {
            name: "Belize",
            c: "501-BZ-0",
            b: "501",
            f: "BZ"
        }, {
            name: "Benin",
            c: "229-BJ-0",
            b: "229",
            f: "BJ"
        }, {
            name: "Bermuda",
            c: "1-BM-0",
            b: "1",
            f: "BM"
        }, {
            name: "Bhutan",
            c: "975-BT-0",
            b: "975",
            f: "BT"
        }, {
            name: "Bolivia",
            c: "591-BO-0",
            b: "591",
            f: "BO"
        }, {
            name: "Bosnia and Herzegovina",
            c: "387-BA-0",
            b: "387",
            f: "BA"
        }, {
            name: "Botswana",
            c: "267-BW-0",
            b: "267",
            f: "BW"
        }, {
            name: "Brazil",
            c: "55-BR-0",
            b: "55",
            f: "BR"
        }, {
            name: "British Indian Ocean Territory",
            c: "246-IO-0",
            b: "246",
            f: "IO"
        }, {
            name: "British Virgin Islands",
            c: "1-VG-0",
            b: "1",
            f: "VG"
        }, {
            name: "Brunei",
            c: "673-BN-0",
            b: "673",
            f: "BN"
        }, {
            name: "Bulgaria",
            c: "359-BG-0",
            b: "359",
            f: "BG"
        }, {
            name: "Burkina Faso",
            c: "226-BF-0",
            b: "226",
            f: "BF"
        }, {
            name: "Burundi",
            c: "257-BI-0",
            b: "257",
            f: "BI"
        }, {
            name: "Cambodia",
            c: "855-KH-0",
            b: "855",
            f: "KH"
        }, {
            name: "Cameroon",
            c: "237-CM-0",
            b: "237",
            f: "CM"
        }, {
            name: "Canada",
            c: "1-CA-0",
            b: "1",
            f: "CA"
        }, {
            name: "Cape Verde",
            c: "238-CV-0",
            b: "238",
            f: "CV"
        }, {
            name: "Caribbean Netherlands",
            c: "599-BQ-0",
            b: "599",
            f: "BQ"
        }, {
            name: "Cayman Islands",
            c: "1-KY-0",
            b: "1",
            f: "KY"
        }, {
            name: "Central African Republic",
            c: "236-CF-0",
            b: "236",
            f: "CF"
        }, {
            name: "Chad",
            c: "235-TD-0",
            b: "235",
            f: "TD"
        }, {
            name: "Chile",
            c: "56-CL-0",
            b: "56",
            f: "CL"
        }, {
            name: "China",
            c: "86-CN-0",
            b: "86",
            f: "CN"
        }, {
            name: "Christmas Island",
            c: "61-CX-0",
            b: "61",
            f: "CX"
        }, {
            name: "Cocos [Keeling] Islands",
            c: "61-CC-0",
            b: "61",
            f: "CC"
        }, {
            name: "Colombia",
            c: "57-CO-0",
            b: "57",
            f: "CO"
        }, {
            name: "Comoros",
            c: "269-KM-0",
            b: "269",
            f: "KM"
        }, {
            name: "Democratic Republic Congo",
            c: "243-CD-0",
            b: "243",
            f: "CD"
        }, {
            name: "Republic of Congo",
            c: "242-CG-0",
            b: "242",
            f: "CG"
        }, {
            name: "Cook Islands",
            c: "682-CK-0",
            b: "682",
            f: "CK"
        }, {
            name: "Costa Rica",
            c: "506-CR-0",
            b: "506",
            f: "CR"
        }, {
            name: "C\u00f4te d'Ivoire",
            c: "225-CI-0",
            b: "225",
            f: "CI"
        }, {
            name: "Croatia",
            c: "385-HR-0",
            b: "385",
            f: "HR"
        }, {
            name: "Cuba",
            c: "53-CU-0",
            b: "53",
            f: "CU"
        }, {
            name: "Cura\u00e7ao",
            c: "599-CW-0",
            b: "599",
            f: "CW"
        }, {
            name: "Cyprus",
            c: "357-CY-0",
            b: "357",
            f: "CY"
        }, {
            name: "Czech Republic",
            c: "420-CZ-0",
            b: "420",
            f: "CZ"
        }, {
            name: "Denmark",
            c: "45-DK-0",
            b: "45",
            f: "DK"
        }, {
            name: "Djibouti",
            c: "253-DJ-0",
            b: "253",
            f: "DJ"
        }, {
            name: "Dominica",
            c: "1-DM-0",
            b: "1",
            f: "DM"
        }, {
            name: "Dominican Republic",
            c: "1-DO-0",
            b: "1",
            f: "DO"
        }, {
            name: "East Timor",
            c: "670-TL-0",
            b: "670",
            f: "TL"
        }, {
            name: "Ecuador",
            c: "593-EC-0",
            b: "593",
            f: "EC"
        }, {
            name: "Egypt",
            c: "20-EG-0",
            b: "20",
            f: "EG"
        }, {
            name: "El Salvador",
            c: "503-SV-0",
            b: "503",
            f: "SV"
        }, {
            name: "Equatorial Guinea",
            c: "240-GQ-0",
            b: "240",
            f: "GQ"
        }, {
            name: "Eritrea",
            c: "291-ER-0",
            b: "291",
            f: "ER"
        }, {
            name: "Estonia",
            c: "372-EE-0",
            b: "372",
            f: "EE"
        }, {
            name: "Ethiopia",
            c: "251-ET-0",
            b: "251",
            f: "ET"
        }, {
            name: "Falkland Islands [Islas Malvinas]",
            c: "500-FK-0",
            b: "500",
            f: "FK"
        }, {
            name: "Faroe Islands",
            c: "298-FO-0",
            b: "298",
            f: "FO"
        }, {
            name: "Fiji",
            c: "679-FJ-0",
            b: "679",
            f: "FJ"
        }, {
            name: "Finland",
            c: "358-FI-0",
            b: "358",
            f: "FI"
        }, {
            name: "France",
            c: "33-FR-0",
            b: "33",
            f: "FR"
        }, {
            name: "French Guiana",
            c: "594-GF-0",
            b: "594",
            f: "GF"
        }, {
            name: "French Polynesia",
            c: "689-PF-0",
            b: "689",
            f: "PF"
        }, {
            name: "Gabon",
            c: "241-GA-0",
            b: "241",
            f: "GA"
        }, {
            name: "Gambia",
            c: "220-GM-0",
            b: "220",
            f: "GM"
        }, {
            name: "Georgia",
            c: "995-GE-0",
            b: "995",
            f: "GE"
        }, {
            name: "Germany",
            c: "49-DE-0",
            b: "49",
            f: "DE"
        }, {
            name: "Ghana",
            c: "233-GH-0",
            b: "233",
            f: "GH"
        }, {
            name: "Gibraltar",
            c: "350-GI-0",
            b: "350",
            f: "GI"
        }, {
            name: "Greece",
            c: "30-GR-0",
            b: "30",
            f: "GR"
        }, {
            name: "Greenland",
            c: "299-GL-0",
            b: "299",
            f: "GL"
        }, {
            name: "Grenada",
            c: "1-GD-0",
            b: "1",
            f: "GD"
        }, {
            name: "Guadeloupe",
            c: "590-GP-0",
            b: "590",
            f: "GP"
        }, {
            name: "Guam",
            c: "1-GU-0",
            b: "1",
            f: "GU"
        }, {
            name: "Guatemala",
            c: "502-GT-0",
            b: "502",
            f: "GT"
        }, {
            name: "Guernsey",
            c: "44-GG-0",
            b: "44",
            f: "GG"
        }, {
            name: "Guinea Conakry",
            c: "224-GN-0",
            b: "224",
            f: "GN"
        }, {
            name: "Guinea-Bissau",
            c: "245-GW-0",
            b: "245",
            f: "GW"
        }, {
            name: "Guyana",
            c: "592-GY-0",
            b: "592",
            f: "GY"
        }, {
            name: "Haiti",
            c: "509-HT-0",
            b: "509",
            f: "HT"
        }, {
            name: "Heard Island and McDonald Islands",
            c: "672-HM-0",
            b: "672",
            f: "HM"
        }, {
            name: "Honduras",
            c: "504-HN-0",
            b: "504",
            f: "HN"
        }, {
            name: "Hong Kong",
            c: "852-HK-0",
            b: "852",
            f: "HK"
        }, {
            name: "Hungary",
            c: "36-HU-0",
            b: "36",
            f: "HU"
        }, {
            name: "Iceland",
            c: "354-IS-0",
            b: "354",
            f: "IS"
        }, {
            name: "India",
            c: "91-IN-0",
            b: "91",
            f: "IN"
        }, {
            name: "Indonesia",
            c: "62-ID-0",
            b: "62",
            f: "ID"
        }, {
            name: "Iran",
            c: "98-IR-0",
            b: "98",
            f: "IR"
        }, {
            name: "Iraq",
            c: "964-IQ-0",
            b: "964",
            f: "IQ"
        }, {
            name: "Ireland",
            c: "353-IE-0",
            b: "353",
            f: "IE"
        }, {
            name: "Isle of Man",
            c: "44-IM-0",
            b: "44",
            f: "IM"
        }, {
            name: "Israel",
            c: "972-IL-0",
            b: "972",
            f: "IL"
        }, {
            name: "Italy",
            c: "39-IT-0",
            b: "39",
            f: "IT"
        }, {
            name: "Jamaica",
            c: "1-JM-0",
            b: "1",
            f: "JM"
        }, {
            name: "Japan",
            c: "81-JP-0",
            b: "81",
            f: "JP"
        }, {
            name: "Jersey",
            c: "44-JE-0",
            b: "44",
            f: "JE"
        }, {
            name: "Jordan",
            c: "962-JO-0",
            b: "962",
            f: "JO"
        }, {
            name: "Kazakhstan",
            c: "7-KZ-0",
            b: "7",
            f: "KZ"
        }, {
            name: "Kenya",
            c: "254-KE-0",
            b: "254",
            f: "KE"
        }, {
            name: "Kiribati",
            c: "686-KI-0",
            b: "686",
            f: "KI"
        }, {
            name: "Kosovo",
            c: "377-XK-0",
            b: "377",
            f: "XK"
        }, {
            name: "Kosovo",
            c: "381-XK-0",
            b: "381",
            f: "XK"
        }, {
            name: "Kosovo",
            c: "386-XK-0",
            b: "386",
            f: "XK"
        }, {
            name: "Kuwait",
            c: "965-KW-0",
            b: "965",
            f: "KW"
        }, {
            name: "Kyrgyzstan",
            c: "996-KG-0",
            b: "996",
            f: "KG"
        }, {
            name: "Laos",
            c: "856-LA-0",
            b: "856",
            f: "LA"
        }, {
            name: "Latvia",
            c: "371-LV-0",
            b: "371",
            f: "LV"
        }, {
            name: "Lebanon",
            c: "961-LB-0",
            b: "961",
            f: "LB"
        }, {
            name: "Lesotho",
            c: "266-LS-0",
            b: "266",
            f: "LS"
        }, {
            name: "Liberia",
            c: "231-LR-0",
            b: "231",
            f: "LR"
        }, {
            name: "Libya",
            c: "218-LY-0",
            b: "218",
            f: "LY"
        }, {
            name: "Liechtenstein",
            c: "423-LI-0",
            b: "423",
            f: "LI"
        }, {
            name: "Lithuania",
            c: "370-LT-0",
            b: "370",
            f: "LT"
        }, {
            name: "Luxembourg",
            c: "352-LU-0",
            b: "352",
            f: "LU"
        }, {
            name: "Macau",
            c: "853-MO-0",
            b: "853",
            f: "MO"
        }, {
            name: "Macedonia",
            c: "389-MK-0",
            b: "389",
            f: "MK"
        }, {
            name: "Madagascar",
            c: "261-MG-0",
            b: "261",
            f: "MG"
        }, {
            name: "Malawi",
            c: "265-MW-0",
            b: "265",
            f: "MW"
        }, {
            name: "Malaysia",
            c: "60-MY-0",
            b: "60",
            f: "MY"
        }, {
            name: "Maldives",
            c: "960-MV-0",
            b: "960",
            f: "MV"
        }, {
            name: "Mali",
            c: "223-ML-0",
            b: "223",
            f: "ML"
        }, {
            name: "Malta",
            c: "356-MT-0",
            b: "356",
            f: "MT"
        }, {
            name: "Marshall Islands",
            c: "692-MH-0",
            b: "692",
            f: "MH"
        }, {
            name: "Martinique",
            c: "596-MQ-0",
            b: "596",
            f: "MQ"
        }, {
            name: "Mauritania",
            c: "222-MR-0",
            b: "222",
            f: "MR"
        }, {
            name: "Mauritius",
            c: "230-MU-0",
            b: "230",
            f: "MU"
        }, {
            name: "Mayotte",
            c: "262-YT-0",
            b: "262",
            f: "YT"
        }, {
            name: "Mexico",
            c: "52-MX-0",
            b: "52",
            f: "MX"
        }, {
            name: "Micronesia",
            c: "691-FM-0",
            b: "691",
            f: "FM"
        }, {
            name: "Moldova",
            c: "373-MD-0",
            b: "373",
            f: "MD"
        }, {
            name: "Monaco",
            c: "377-MC-0",
            b: "377",
            f: "MC"
        }, {
            name: "Mongolia",
            c: "976-MN-0",
            b: "976",
            f: "MN"
        }, {
            name: "Montenegro",
            c: "382-ME-0",
            b: "382",
            f: "ME"
        }, {
            name: "Montserrat",
            c: "1-MS-0",
            b: "1",
            f: "MS"
        }, {
            name: "Morocco",
            c: "212-MA-0",
            b: "212",
            f: "MA"
        }, {
            name: "Mozambique",
            c: "258-MZ-0",
            b: "258",
            f: "MZ"
        }, {
            name: "Myanmar [Burma]",
            c: "95-MM-0",
            b: "95",
            f: "MM"
        }, {
            name: "Namibia",
            c: "264-NA-0",
            b: "264",
            f: "NA"
        }, {
            name: "Nauru",
            c: "674-NR-0",
            b: "674",
            f: "NR"
        }, {
            name: "Nepal",
            c: "977-NP-0",
            b: "977",
            f: "NP"
        }, {
            name: "Netherlands",
            c: "31-NL-0",
            b: "31",
            f: "NL"
        }, {
            name: "New Caledonia",
            c: "687-NC-0",
            b: "687",
            f: "NC"
        }, {
            name: "New Zealand",
            c: "64-NZ-0",
            b: "64",
            f: "NZ"
        }, {
            name: "Nicaragua",
            c: "505-NI-0",
            b: "505",
            f: "NI"
        }, {
            name: "Niger",
            c: "227-NE-0",
            b: "227",
            f: "NE"
        }, {
            name: "Nigeria",
            c: "234-NG-0",
            b: "234",
            f: "NG"
        }, {
            name: "Niue",
            c: "683-NU-0",
            b: "683",
            f: "NU"
        }, {
            name: "Norfolk Island",
            c: "672-NF-0",
            b: "672",
            f: "NF"
        }, {
            name: "North Korea",
            c: "850-KP-0",
            b: "850",
            f: "KP"
        }, {
            name: "Northern Mariana Islands",
            c: "1-MP-0",
            b: "1",
            f: "MP"
        }, {
            name: "Norway",
            c: "47-NO-0",
            b: "47",
            f: "NO"
        }, {
            name: "Oman",
            c: "968-OM-0",
            b: "968",
            f: "OM"
        }, {
            name: "Pakistan",
            c: "92-PK-0",
            b: "92",
            f: "PK"
        }, {
            name: "Palau",
            c: "680-PW-0",
            b: "680",
            f: "PW"
        }, {
            name: "Palestinian Territories",
            c: "970-PS-0",
            b: "970",
            f: "PS"
        }, {
            name: "Panama",
            c: "507-PA-0",
            b: "507",
            f: "PA"
        }, {
            name: "Papua New Guinea",
            c: "675-PG-0",
            b: "675",
            f: "PG"
        }, {
            name: "Paraguay",
            c: "595-PY-0",
            b: "595",
            f: "PY"
        }, {
            name: "Peru",
            c: "51-PE-0",
            b: "51",
            f: "PE"
        }, {
            name: "Philippines",
            c: "63-PH-0",
            b: "63",
            f: "PH"
        }, {
            name: "Poland",
            c: "48-PL-0",
            b: "48",
            f: "PL"
        }, {
            name: "Portugal",
            c: "351-PT-0",
            b: "351",
            f: "PT"
        }, {
            name: "Puerto Rico",
            c: "1-PR-0",
            b: "1",
            f: "PR"
        }, {
            name: "Qatar",
            c: "974-QA-0",
            b: "974",
            f: "QA"
        }, {
            name: "R\u00e9union",
            c: "262-RE-0",
            b: "262",
            f: "RE"
        }, {
            name: "Romania",
            c: "40-RO-0",
            b: "40",
            f: "RO"
        }, {
            name: "Russia",
            c: "7-RU-0",
            b: "7",
            f: "RU"
        }, {
            name: "Rwanda",
            c: "250-RW-0",
            b: "250",
            f: "RW"
        }, {
            name: "Saint Barth\u00e9lemy",
            c: "590-BL-0",
            b: "590",
            f: "BL"
        }, {
            name: "Saint Helena",
            c: "290-SH-0",
            b: "290",
            f: "SH"
        }, {
            name: "St. Kitts",
            c: "1-KN-0",
            b: "1",
            f: "KN"
        }, {
            name: "St. Lucia",
            c: "1-LC-0",
            b: "1",
            f: "LC"
        }, {
            name: "Saint Martin",
            c: "590-MF-0",
            b: "590",
            f: "MF"
        }, {
            name: "Saint Pierre and Miquelon",
            c: "508-PM-0",
            b: "508",
            f: "PM"
        }, {
            name: "St. Vincent",
            c: "1-VC-0",
            b: "1",
            f: "VC"
        }, {
            name: "Samoa",
            c: "685-WS-0",
            b: "685",
            f: "WS"
        }, {
            name: "San Marino",
            c: "378-SM-0",
            b: "378",
            f: "SM"
        }, {
            name: "S\u00e3o Tom\u00e9 and Pr\u00edncipe",
            c: "239-ST-0",
            b: "239",
            f: "ST"
        }, {
            name: "Saudi Arabia",
            c: "966-SA-0",
            b: "966",
            f: "SA"
        }, {
            name: "Senegal",
            c: "221-SN-0",
            b: "221",
            f: "SN"
        }, {
            name: "Serbia",
            c: "381-RS-0",
            b: "381",
            f: "RS"
        }, {
            name: "Seychelles",
            c: "248-SC-0",
            b: "248",
            f: "SC"
        }, {
            name: "Sierra Leone",
            c: "232-SL-0",
            b: "232",
            f: "SL"
        }, {
            name: "Singapore",
            c: "65-SG-0",
            b: "65",
            f: "SG"
        }, {
            name: "Sint Maarten",
            c: "1-SX-0",
            b: "1",
            f: "SX"
        }, {
            name: "Slovakia",
            c: "421-SK-0",
            b: "421",
            f: "SK"
        }, {
            name: "Slovenia",
            c: "386-SI-0",
            b: "386",
            f: "SI"
        }, {
            name: "Solomon Islands",
            c: "677-SB-0",
            b: "677",
            f: "SB"
        }, {
            name: "Somalia",
            c: "252-SO-0",
            b: "252",
            f: "SO"
        }, {
            name: "South Africa",
            c: "27-ZA-0",
            b: "27",
            f: "ZA"
        }, {
            name: "South Georgia and the South Sandwich Islands",
            c: "500-GS-0",
            b: "500",
            f: "GS"
        }, {
            name: "South Korea",
            c: "82-KR-0",
            b: "82",
            f: "KR"
        }, {
            name: "South Sudan",
            c: "211-SS-0",
            b: "211",
            f: "SS"
        }, {
            name: "Spain",
            c: "34-ES-0",
            b: "34",
            f: "ES"
        }, {
            name: "Sri Lanka",
            c: "94-LK-0",
            b: "94",
            f: "LK"
        }, {
            name: "Sudan",
            c: "249-SD-0",
            b: "249",
            f: "SD"
        }, {
            name: "Suriname",
            c: "597-SR-0",
            b: "597",
            f: "SR"
        }, {
            name: "Svalbard and Jan Mayen",
            c: "47-SJ-0",
            b: "47",
            f: "SJ"
        }, {
            name: "Swaziland",
            c: "268-SZ-0",
            b: "268",
            f: "SZ"
        }, {
            name: "Sweden",
            c: "46-SE-0",
            b: "46",
            f: "SE"
        }, {
            name: "Switzerland",
            c: "41-CH-0",
            b: "41",
            f: "CH"
        }, {
            name: "Syria",
            c: "963-SY-0",
            b: "963",
            f: "SY"
        }, {
            name: "Taiwan",
            c: "886-TW-0",
            b: "886",
            f: "TW"
        }, {
            name: "Tajikistan",
            c: "992-TJ-0",
            b: "992",
            f: "TJ"
        }, {
            name: "Tanzania",
            c: "255-TZ-0",
            b: "255",
            f: "TZ"
        }, {
            name: "Thailand",
            c: "66-TH-0",
            b: "66",
            f: "TH"
        }, {
            name: "Togo",
            c: "228-TG-0",
            b: "228",
            f: "TG"
        }, {
            name: "Tokelau",
            c: "690-TK-0",
            b: "690",
            f: "TK"
        }, {
            name: "Tonga",
            c: "676-TO-0",
            b: "676",
            f: "TO"
        }, {
            name: "Trinidad/Tobago",
            c: "1-TT-0",
            b: "1",
            f: "TT"
        }, {
            name: "Tunisia",
            c: "216-TN-0",
            b: "216",
            f: "TN"
        }, {
            name: "Turkey",
            c: "90-TR-0",
            b: "90",
            f: "TR"
        }, {
            name: "Turkmenistan",
            c: "993-TM-0",
            b: "993",
            f: "TM"
        }, {
            name: "Turks and Caicos Islands",
            c: "1-TC-0",
            b: "1",
            f: "TC"
        }, {
            name: "Tuvalu",
            c: "688-TV-0",
            b: "688",
            f: "TV"
        }, {
            name: "U.S. Virgin Islands",
            c: "1-VI-0",
            b: "1",
            f: "VI"
        }, {
            name: "Uganda",
            c: "256-UG-0",
            b: "256",
            f: "UG"
        }, {
            name: "Ukraine",
            c: "380-UA-0",
            b: "380",
            f: "UA"
        }, {
            name: "United Arab Emirates",
            c: "971-AE-0",
            b: "971",
            f: "AE"
        }, {
            name: "United Kingdom",
            c: "44-GB-0",
            b: "44",
            f: "GB"
        }, {
            name: "United States",
            c: "1-US-0",
            b: "1",
            f: "US"
        }, {
            name: "Uruguay",
            c: "598-UY-0",
            b: "598",
            f: "UY"
        }, {
            name: "Uzbekistan",
            c: "998-UZ-0",
            b: "998",
            f: "UZ"
        }, {
            name: "Vanuatu",
            c: "678-VU-0",
            b: "678",
            f: "VU"
        }, {
            name: "Vatican City",
            c: "379-VA-0",
            b: "379",
            f: "VA"
        }, {
            name: "Venezuela",
            c: "58-VE-0",
            b: "58",
            f: "VE"
        }, {
            name: "Vietnam",
            c: "84-VN-0",
            b: "84",
            f: "VN"
        }, {
            name: "Wallis and Futuna",
            c: "681-WF-0",
            b: "681",
            f: "WF"
        }, {
            name: "Western Sahara",
            c: "212-EH-0",
            b: "212",
            f: "EH"
        }, {
            name: "Yemen",
            c: "967-YE-0",
            b: "967",
            f: "YE"
        }, {
            name: "Zambia",
            c: "260-ZM-0",
            b: "260",
            f: "ZM"
        }, {
            name: "Zimbabwe",
            c: "263-ZW-0",
            b: "263",
            f: "ZW"
        }];
        gi(di);
        var hi = new ai(di);

        function ii(a, b) {
            this.a = a;
            this.za = b
        }

        function ji(a) {
            a = Wa(a);
            var b = bi(hi, a);
            return 0 < b.length ? new ii("1" == b[0].b ? "1-US-0" : b[0].c, Wa(a.substr(b[0].b.length +
                1))) : null
        }

        function ki(a) {
            var b = ci(a.a);
            if (!b) throw Error("Country ID " + a.a + " not found.");
            return "+" + b.b + a.za
        }

        function li(a, b) {
            for (var c = 0; c < a.length; c++)
                if (!Na(mi, a[c]) && (null !== ni && a[c] in ni || Na(b, a[c]))) return a[c];
            return null
        }
        var mi = ["emailLink", "password", "phone"],
            ni = {
                "facebook.com": "FacebookAuthProvider",
                "github.com": "GithubAuthProvider",
                "google.com": "GoogleAuthProvider",
                password: "EmailAuthProvider",
                "twitter.com": "TwitterAuthProvider",
                phone: "PhoneAuthProvider"
            };

        function oi() {
            this.a = new Uh;
            H(this.a,
                "acUiConfig");
            H(this.a, "autoUpgradeAnonymousUsers");
            H(this.a, "callbacks");
            H(this.a, "credentialHelper", pi);
            H(this.a, "immediateFederatedRedirect", !1);
            H(this.a, "popupMode", !1);
            H(this.a, "privacyPolicyUrl");
            H(this.a, "queryParameterForSignInSuccessUrl", "signInSuccessUrl");
            H(this.a, "queryParameterForWidgetMode", "mode");
            H(this.a, "signInFlow");
            H(this.a, "signInOptions");
            H(this.a, "signInSuccessUrl");
            H(this.a, "siteName");
            H(this.a, "tosUrl");
            H(this.a, "widgetUrl")
        }

        function qi(a) {
            return a.a.get("acUiConfig") || null
        }

        function ri(a) {
            var b = a.a.get("widgetUrl") || vf();
            return si(a, b)
        }

        function si(a, b) {
            a = ti(a);
            for (var c = b.search(ub), d = 0, e, f = []; 0 <= (e = tb(b, d, a, c));) f.push(b.substring(d, e)), d = Math.min(b.indexOf("&", e) + 1 || c, c);
            f.push(b.substr(d));
            b = f.join("").replace(wb, "$1");
            c = "=" + encodeURIComponent("select");
            (a += c) ? (c = b.indexOf("#"), 0 > c && (c = b.length), d = b.indexOf("?"), 0 > d || d > c ? (d = c, e = "") : e = b.substring(d + 1, c), b = [b.substr(0, d), e, b.substr(c)], c = b[1], b[1] = a ? c ? c + "&" + a : a : c, a = b[0] + (b[1] ? "?" + b[1] : "") + b[2]) : a = b;
            return a
        }

        function ui(a) {
            var b = !!a.a.get("autoUpgradeAnonymousUsers");
            b && !vi(a) && rg('Missing "signInFailure" callback: "signInFailure" callback needs to be provided when "autoUpgradeAnonymousUsers" is set to true.', void 0);
            return b
        }

        function wi(a) {
            a = a.a.get("signInOptions") || [];
            for (var b = [], c = 0; c < a.length; c++) {
                var d = a[c];
                d = ta(d) ? d : {
                    provider: d
                };
                d.provider && b.push(d)
            }
            return b
        }

        function xi(a, b) {
            a = wi(a);
            for (var c = 0; c < a.length; c++)
                if (a[c].provider === b) return a[c];
            return null
        }

        function yi(a) {
            return Ka(wi(a), function(b) {
                return b.provider
            })
        }

        function zi(a, b) {
            a = Ai(a);
            for (var c = 0; c < a.length; c++)
                if (a[c].providerId === b) return a[c];
            return null
        }

        function Ai(a) {
            return Ka(wi(a), function(b) {
                return ni[b.provider] || Na(Bi, b.provider) ? {
                    providerId: b.provider
                } : {
                    providerId: b.provider,
                    qb: b.providerName || null,
                    Ga: b.buttonColor || null,
                    Ma: b.iconUrl ? Cc(Fc(b.iconUrl)) : null,
                    Nb: b.loginHintKey || null
                }
            })
        }

        function Ci(a) {
            var b = xi(a, firebase.auth.GoogleAuthProvider.PROVIDER_ID);
            return b && b.clientId && Di(a) === Ei ? b.clientId || null : null
        }

        function Fi(a) {
            var b = null;
            Ha(wi(a),
                function(d) {
                    d.provider == firebase.auth.PhoneAuthProvider.PROVIDER_ID && ta(d.recaptchaParameters) && !qa(d.recaptchaParameters) && (b = gb(d.recaptchaParameters))
                });
            if (b) {
                var c = [];
                Ha(Gi, function(d) {
                    "undefined" !== typeof b[d] && (c.push(d), delete b[d])
                });
                c.length && wg('The following provided "recaptchaParameters" keys are not allowed: ' + c.join(", "))
            }
            return b
        }

        function Hi(a, b) {
            a = (a = xi(a, b)) && a.scopes;
            return qa(a) ? a : []
        }

        function Ii(a, b) {
            a = (a = xi(a, b)) && a.customParameters;
            return ta(a) ? (a = gb(a), b === firebase.auth.GoogleAuthProvider.PROVIDER_ID &&
                delete a.login_hint, b === firebase.auth.GithubAuthProvider.PROVIDER_ID && delete a.login, a) : null
        }

        function Ji(a) {
            a = xi(a, firebase.auth.PhoneAuthProvider.PROVIDER_ID);
            var b = null;
            a && "string" === typeof a.loginHint && (b = ji(a.loginHint));
            return a && a.defaultNationalNumber || b && b.za || null
        }

        function Ki(a) {
            var b = (a = xi(a, firebase.auth.PhoneAuthProvider.PROVIDER_ID)) && a.defaultCountry || null;
            b = b && ei(b);
            var c = null;
            a && "string" === typeof a.loginHint && (c = ji(a.loginHint));
            return b && b[0] || c && ci(c.a) || null
        }

        function Li(a) {
            a = xi(a,
                firebase.auth.PhoneAuthProvider.PROVIDER_ID);
            if (!a) return null;
            var b = a.whitelistedCountries,
                c = a.blacklistedCountries;
            if ("undefined" !== typeof b && (!qa(b) || 0 == b.length)) throw Error("WhitelistedCountries must be a non-empty array.");
            if ("undefined" !== typeof c && !qa(c)) throw Error("BlacklistedCountries must be an array.");
            if (b && c) throw Error("Both whitelistedCountries and blacklistedCountries are provided.");
            if (!b && !c) return di;
            a = [];
            if (b) {
                c = {};
                for (var d = 0; d < b.length; d++) {
                    var e = fi(b[d]);
                    for (var f = 0; f < e.length; f++) c[e[f].c] =
                        e[f]
                }
                for (var g in c) c.hasOwnProperty(g) && a.push(c[g])
            } else {
                g = {};
                for (b = 0; b < c.length; b++)
                    for (e = fi(c[b]), d = 0; d < e.length; d++) g[e[d].c] = e[d];
                for (e = 0; e < di.length; e++) null !== g && di[e].c in g || a.push(di[e])
            }
            return a
        }

        function ti(a) {
            return Wh(a.a, "queryParameterForWidgetMode")
        }

        function I(a) {
            var b = a.a.get("tosUrl") || null;
            a = a.a.get("privacyPolicyUrl") || null;
            b && !a && wg("Privacy Policy URL is missing, the link will not be displayed.");
            if (b && a) {
                if (sa(b)) return b;
                if ("string" === typeof b) return function() {
                    tf(b)
                }
            }
            return null
        }

        function Mi(a) {
            var b = a.a.get("tosUrl") || null,
                c = a.a.get("privacyPolicyUrl") || null;
            c && !b && wg("Term of Service URL is missing, the link will not be displayed.");
            if (b && c) {
                if (sa(c)) return c;
                if ("string" === typeof c) return function() {
                    tf(c)
                }
            }
            return null
        }

        function Ni(a) {
            return (a = xi(a, firebase.auth.EmailAuthProvider.PROVIDER_ID)) && "undefined" !== typeof a.requireDisplayName ? !!a.requireDisplayName : !0
        }

        function Oi(a) {
            a = xi(a, firebase.auth.EmailAuthProvider.PROVIDER_ID);
            return !(!a || a.signInMethod !== firebase.auth.EmailAuthProvider.EMAIL_LINK_SIGN_IN_METHOD)
        }

        function Pi(a) {
            a = xi(a, firebase.auth.EmailAuthProvider.PROVIDER_ID);
            return !(!a || !a.forceSameDevice)
        }

        function Qi(a) {
            if (Oi(a)) {
                var b = {
                    url: vf(),
                    handleCodeInApp: !0
                };
                (a = xi(a, firebase.auth.EmailAuthProvider.PROVIDER_ID)) && "function" === typeof a.emailLinkSignIn && ib(b, a.emailLinkSignIn());
                b.url = Mb(vf(), b.url).toString();
                return b
            }
            return null
        }

        function Ri(a) {
            var b = !!a.a.get("immediateFederatedRedirect"),
                c = yi(a);
            a = Si(a);
            return b && 1 == c.length && !Na(mi, c[0]) && a == Ti
        }

        function Si(a) {
            a = a.a.get("signInFlow");
            for (var b in Ui)
                if (Ui[b] ==
                    a) return Ui[b];
            return Ti
        }

        function Vi(a) {
            return Wi(a).uiShown || null
        }

        function Xi(a) {
            return Wi(a).signInSuccess || null
        }

        function Yi(a) {
            return Wi(a).signInSuccessWithAuthResult || null
        }

        function vi(a) {
            return Wi(a).signInFailure || null
        }

        function Wi(a) {
            return a.a.get("callbacks") || {}
        }

        function Di(a) {
            if ("http:" !== (window.location && window.location.protocol) && "https:" !== (window.location && window.location.protocol)) return Zi;
            a = a.a.get("credentialHelper");
            for (var b in $i)
                if ($i[b] == a) return $i[b];
            return pi
        }
        var pi = "accountchooser.com",
            Ei = "googleyolo",
            Zi = "none",
            $i = {
                jc: pi,
                mc: Ei,
                NONE: Zi
            },
            Ti = "redirect",
            Ui = {
                pc: "popup",
                qc: Ti
            },
            aj = {
                lc: "callback",
                RECOVER_EMAIL: "recoverEmail",
                rc: "resetPassword",
                REVERT_SECOND_FACTOR_ADDITION: "revertSecondFactorAddition",
                sc: "select",
                tc: "signIn",
                VERIFY_AND_CHANGE_EMAIL: "verifyAndChangeEmail",
                VERIFY_EMAIL: "verifyEmail"
            },
            Bi = ["anonymous"],
            Gi = ["sitekey", "tabindex", "callback", "expired-callback"];
        var bj, cj, dj, ej, J = {};

        function L(a, b, c, d) {
            J[a].apply(null, Array.prototype.slice.call(arguments, 1))
        }
        var fj = null;

        function gj(a) {
            return !(!a ||
                -32E3 != a.code || "Service unavailable" != a.message)
        }

        function hj(a, b, c, d) {
            fj || (a = {
                callbacks: {
                    empty: a,
                    select: function(e, f) {
                        e && e.account && b ? b(yg(e.account)) : c && c(!gj(f))
                    },
                    store: a,
                    update: a
                },
                language: "en",
                providers: void 0,
                ui: d
            }, "undefined" != typeof accountchooser && accountchooser.Api && accountchooser.Api.init ? fj = accountchooser.Api.init(a) : (fj = new ij(a), jj()))
        }

        function kj(a, b, c) {
            function d() {
                var e = Mb(window.location.href, c).toString();
                fj.select(Ka(b || [], function(f) {
                    return f.aa()
                }), {
                    clientCallbackUrl: e
                })
            }
            b && b.length ?
                d() : fj.checkEmpty(function(e, f) {
                    e || f ? a(!gj(f)) : d()
                })
        }

        function ij(a) {
            this.a = a;
            this.a.callbacks = this.a.callbacks || {}
        }

        function jj() {
            var a = fj;
            sa(a.a.callbacks.empty) && a.a.callbacks.empty()
        }
        k = ij.prototype;
        k.store = function() {
            sa(this.a.callbacks.store) && this.a.callbacks.store(void 0, lj)
        };
        k.select = function() {
            sa(this.a.callbacks.select) && this.a.callbacks.select(void 0, lj)
        };
        k.update = function() {
            sa(this.a.callbacks.update) && this.a.callbacks.update(void 0, lj)
        };
        k.checkDisabled = function(a) {
            a(!0)
        };
        k.checkEmpty = function(a) {
            a(void 0,
                lj)
        };
        k.checkAccountExist = function(a, b) {
            b(void 0, lj)
        };
        k.checkShouldUpdate = function(a, b) {
            b(void 0, lj)
        };
        var lj = {
            code: -32E3,
            message: "Service unavailable",
            data: "Service is unavailable."
        };
        var mj = /MSIE ([\d.]+).*Windows NT ([\d.]+)/,
            nj = /Firefox\/([\d.]+)/,
            oj = /Opera[ \/]([\d.]+)(.*Version\/([\d.]+))?/,
            pj = /Chrome\/([\d.]+)/,
            qj = /((Windows NT ([\d.]+))|(Mac OS X ([\d_]+))).*Version\/([\d.]+).*Safari/,
            rj = /Mac OS X;.*(?!(Version)).*Safari/,
            sj = /Android ([\d.]+).*Safari/,
            tj = /OS ([\d_]+) like Mac OS X.*Mobile.*Safari/,
            uj = /Konqueror\/([\d.]+)/,
            vj = /MSIE ([\d.]+).*Windows Phone OS ([\d.]+)/;

        function wj(a, b) {
            a = a.split(b || ".");
            this.a = [];
            for (b = 0; b < a.length; b++) this.a.push(parseInt(a[b], 10))
        }

        function xj(a, b) {
            b instanceof wj || (b = new wj(String(b)));
            for (var c = Math.max(a.a.length, b.a.length), d = 0; d < c; d++) {
                var e = a.a[d],
                    f = b.a[d];
                if (void 0 !== e && void 0 !== f && e !== f) return e - f;
                if (void 0 === e) return -1;
                if (void 0 === f) return 1
            }
            return 0
        }

        function yj(a, b) {
            return 0 <= xj(a, b)
        }

        function zj() {
            var a = window.navigator && window.navigator.userAgent;
            if (a) {
                var b;
                if (b = a.match(oj)) {
                    var c = new wj(b[3] || b[1]);
                    return 0 <= a.indexOf("Opera Mini") ? !1 : 0 <= a.indexOf("Opera Mobi") ? 0 <= a.indexOf("Android") && yj(c, "10.1") : yj(c, "8.0")
                }
                if (b = a.match(nj)) return yj(new wj(b[1]), "2.0");
                if (b = a.match(pj)) return yj(new wj(b[1]), "6.0");
                if (b = a.match(qj)) return c = new wj(b[6]), a = b[3] && new wj(b[3]), b = b[5] && new wj(b[5], "_"), (!(!a || !yj(a, "6.0")) || !(!b || !yj(b, "10.5.6"))) && yj(c, "3.0");
                if (b = a.match(sj)) return yj(new wj(b[1]), "3.0");
                if (b = a.match(tj)) return yj(new wj(b[1], "_"), "4.0");
                if (b = a.match(uj)) return yj(new wj(b[1]), "4.7");
                if (b = a.match(vj)) return c = new wj(b[1]), a = new wj(b[2]), yj(c, "7.0") && yj(a, "7.0");
                if (b = a.match(mj)) return c = new wj(b[1]), a = new wj(b[2]), yj(c, "7.0") && yj(a, "6.0");
                if (a.match(rj)) return !1
            }
            return !0
        }

        function Aj(a) {
            if (a.classList) return a.classList;
            a = a.className;
            return q(a) && a.match(/\S+/g) || []
        }

        function Bj(a, b) {
            return a.classList ? a.classList.contains(b) : Na(Aj(a), b)
        }

        function Cj(a, b) {
            a.classList ? a.classList.add(b) : Bj(a, b) || (a.className += 0 < a.className.length ? " " +
                b : b)
        }

        function Dj(a, b) {
            a.classList ? a.classList.remove(b) : Bj(a, b) && (a.className = Ja(Aj(a), function(c) {
                return c != b
            }).join(" "))
        }

        function Ej(a) {
            var b = a.type;
            switch (q(b) && b.toLowerCase()) {
                case "checkbox":
                case "radio":
                    return a.checked ? a.value : null;
                case "select-one":
                    return b = a.selectedIndex, 0 <= b ? a.options[b].value : null;
                case "select-multiple":
                    b = [];
                    for (var c, d = 0; c = a.options[d]; d++) c.selected && b.push(c.value);
                    return b.length ? b : null;
                default:
                    return null != a.value ? a.value : null
            }
        }

        function Fj(a, b) {
            var c = a.type;
            switch (q(c) &&
                c.toLowerCase()) {
                case "checkbox":
                case "radio":
                    a.checked = b;
                    break;
                case "select-one":
                    a.selectedIndex = -1;
                    if (q(b))
                        for (var d = 0; c = a.options[d]; d++)
                            if (c.value == b) {
                                c.selected = !0;
                                break
                            } break;
                case "select-multiple":
                    q(b) && (b = [b]);
                    for (d = 0; c = a.options[d]; d++)
                        if (c.selected = !1, b)
                            for (var e, f = 0; e = b[f]; f++) c.value == e && (c.selected = !0);
                    break;
                default:
                    a.value = null != b ? b : ""
            }
        }

        function Gj(a) {
            if (a.altKey && !a.ctrlKey || a.metaKey || 112 <= a.keyCode && 123 >= a.keyCode) return !1;
            if (Hj(a.keyCode)) return !0;
            switch (a.keyCode) {
                case 18:
                case 20:
                case 93:
                case 17:
                case 40:
                case 35:
                case 27:
                case 36:
                case 45:
                case 37:
                case 224:
                case 91:
                case 144:
                case 12:
                case 34:
                case 33:
                case 19:
                case 255:
                case 44:
                case 39:
                case 145:
                case 16:
                case 38:
                case 252:
                case 224:
                case 92:
                    return !1;
                case 0:
                    return !gc;
                default:
                    return 166 > a.keyCode || 183 < a.keyCode
            }
        }

        function Ij(a, b, c, d, e, f) {
            if (hc && !pc("525")) return !0;
            if (jc && e) return Hj(a);
            if (e && !d) return !1;
            if (!gc) {
                "number" == typeof b && (b = Jj(b));
                var g = 17 == b || 18 == b || jc && 91 == b;
                if ((!c || jc) && g || jc && 16 == b && (d || f)) return !1
            }
            if ((hc || ec) && d && c) switch (a) {
                case 220:
                case 219:
                case 221:
                case 192:
                case 186:
                case 189:
                case 187:
                case 188:
                case 190:
                case 191:
                case 192:
                case 222:
                    return !1
            }
            if (z && d && b == a) return !1;
            switch (a) {
                case 13:
                    return gc ? f || e ? !1 : !(c && d) : !0;
                case 27:
                    return !(hc || ec ||
                        gc)
            }
            return gc && (d || e || f) ? !1 : Hj(a)
        }

        function Hj(a) {
            if (48 <= a && 57 >= a || 96 <= a && 106 >= a || 65 <= a && 90 >= a || (hc || ec) && 0 == a) return !0;
            switch (a) {
                case 32:
                case 43:
                case 63:
                case 64:
                case 107:
                case 109:
                case 110:
                case 111:
                case 186:
                case 59:
                case 189:
                case 187:
                case 61:
                case 188:
                case 190:
                case 191:
                case 192:
                case 222:
                case 219:
                case 220:
                case 221:
                case 163:
                    return !0;
                case 173:
                    return gc;
                default:
                    return !1
            }
        }

        function Jj(a) {
            if (gc) a = Kj(a);
            else if (jc && hc) switch (a) {
                case 93:
                    a = 91
            }
            return a
        }

        function Kj(a) {
            switch (a) {
                case 61:
                    return 187;
                case 59:
                    return 186;
                case 173:
                    return 189;
                case 224:
                    return 91;
                case 0:
                    return 224;
                default:
                    return a
            }
        }

        function Lj(a) {
            E.call(this);
            this.a = a;
            me(a, "keydown", this.g, !1, this);
            me(a, "click", this.h, !1, this)
        }
        w(Lj, E);
        Lj.prototype.g = function(a) {
            (13 == a.keyCode || hc && 3 == a.keyCode) && Mj(this, a)
        };
        Lj.prototype.h = function(a) {
            Mj(this, a)
        };

        function Mj(a, b) {
            var c = new Nj(b);
            if (ze(a, c)) {
                c = new Oj(b);
                try {
                    ze(a, c)
                } finally {
                    b.stopPropagation()
                }
            }
        }
        Lj.prototype.m = function() {
            Lj.L.m.call(this);
            ue(this.a, "keydown", this.g, !1, this);
            ue(this.a, "click", this.h, !1, this);
            delete this.a
        };

        function Oj(a) {
            ae.call(this, a.a);
            this.type = "action"
        }
        w(Oj, ae);

        function Nj(a) {
            ae.call(this, a.a);
            this.type = "beforeaction"
        }
        w(Nj, ae);

        function Pj(a) {
            E.call(this);
            this.a = a;
            a = z ? "focusout" : "blur";
            this.g = me(this.a, z ? "focusin" : "focus", this, !z);
            this.h = me(this.a, a, this, !z)
        }
        w(Pj, E);
        Pj.prototype.handleEvent = function(a) {
            var b = new ae(a.a);
            b.type = "focusin" == a.type || "focus" == a.type ? "focusin" : "focusout";
            ze(this, b)
        };
        Pj.prototype.m = function() {
            Pj.L.m.call(this);
            ve(this.g);
            ve(this.h);
            delete this.a
        };

        function Qj(a,
            b) {
            E.call(this);
            this.g = a || 1;
            this.a = b || n;
            this.h = t(this.fc, this);
            this.j = za()
        }
        w(Qj, E);
        k = Qj.prototype;
        k.Ja = !1;
        k.$ = null;
        k.fc = function() {
            if (this.Ja) {
                var a = za() - this.j;
                0 < a && a < .8 * this.g ? this.$ = this.a.setTimeout(this.h, this.g - a) : (this.$ && (this.a.clearTimeout(this.$), this.$ = null), ze(this, "tick"), this.Ja && (Rj(this), this.start()))
            }
        };
        k.start = function() {
            this.Ja = !0;
            this.$ || (this.$ = this.a.setTimeout(this.h, this.g), this.j = za())
        };

        function Rj(a) {
            a.Ja = !1;
            a.$ && (a.a.clearTimeout(a.$), a.$ = null)
        }
        k.m = function() {
            Qj.L.m.call(this);
            Rj(this);
            delete this.a
        };

        function Sj(a, b) {
            if (sa(a)) b && (a = t(a, b));
            else if (a && "function" == typeof a.handleEvent) a = t(a.handleEvent, a);
            else throw Error("Invalid listener argument");
            return 2147483647 < Number(0) ? -1 : n.setTimeout(a, 0)
        }

        function Tj(a) {
            Rd.call(this);
            this.g = a;
            this.a = {}
        }
        w(Tj, Rd);
        var Uj = [];

        function Vj(a, b, c, d) {
            qa(c) || (c && (Uj[0] = c.toString()), c = Uj);
            for (var e = 0; e < c.length; e++) {
                var f = me(b, c[e], d || a.handleEvent, !1, a.g || a);
                if (!f) break;
                a.a[f.key] = f
            }
        }

        function Wj(a) {
            fb(a.a, function(b, c) {
                this.a.hasOwnProperty(c) &&
                    ve(b)
            }, a);
            a.a = {}
        }
        Tj.prototype.m = function() {
            Tj.L.m.call(this);
            Wj(this)
        };
        Tj.prototype.handleEvent = function() {
            throw Error("EventHandler.handleEvent not implemented");
        };

        function Xj(a) {
            E.call(this);
            this.a = null;
            this.g = a;
            a = z || ec || hc && !pc("531") && "TEXTAREA" == a.tagName;
            this.h = new Tj(this);
            Vj(this.h, this.g, a ? ["keydown", "paste", "cut", "drop", "input"] : "input", this)
        }
        w(Xj, E);
        Xj.prototype.handleEvent = function(a) {
            if ("input" == a.type) z && pc(10) && 0 == a.keyCode && 0 == a.j || (Yj(this), ze(this, Zj(a)));
            else if ("keydown" != a.type ||
                Gj(a)) {
                var b = "keydown" == a.type ? this.g.value : null;
                z && 229 == a.keyCode && (b = null);
                var c = Zj(a);
                Yj(this);
                this.a = Sj(function() {
                    this.a = null;
                    this.g.value != b && ze(this, c)
                }, this)
            }
        };

        function Yj(a) {
            null != a.a && (n.clearTimeout(a.a), a.a = null)
        }

        function Zj(a) {
            a = new ae(a.a);
            a.type = "input";
            return a
        }
        Xj.prototype.m = function() {
            Xj.L.m.call(this);
            this.h.o();
            Yj(this);
            delete this.g
        };

        function ak(a, b) {
            E.call(this);
            a && (this.Oa && bk(this), this.qa = a, this.Na = me(this.qa, "keypress", this, b), this.Ya = me(this.qa, "keydown", this.Ib, b, this),
                this.Oa = me(this.qa, "keyup", this.Jb, b, this))
        }
        w(ak, E);
        k = ak.prototype;
        k.qa = null;
        k.Na = null;
        k.Ya = null;
        k.Oa = null;
        k.S = -1;
        k.W = -1;
        k.Ua = !1;
        var ck = {
                3: 13,
                12: 144,
                63232: 38,
                63233: 40,
                63234: 37,
                63235: 39,
                63236: 112,
                63237: 113,
                63238: 114,
                63239: 115,
                63240: 116,
                63241: 117,
                63242: 118,
                63243: 119,
                63244: 120,
                63245: 121,
                63246: 122,
                63247: 123,
                63248: 44,
                63272: 46,
                63273: 36,
                63275: 35,
                63276: 33,
                63277: 34,
                63289: 144,
                63302: 45
            },
            dk = {
                Up: 38,
                Down: 40,
                Left: 37,
                Right: 39,
                Enter: 13,
                F1: 112,
                F2: 113,
                F3: 114,
                F4: 115,
                F5: 116,
                F6: 117,
                F7: 118,
                F8: 119,
                F9: 120,
                F10: 121,
                F11: 122,
                F12: 123,
                "U+007F": 46,
                Home: 36,
                End: 35,
                PageUp: 33,
                PageDown: 34,
                Insert: 45
            },
            ek = !hc || pc("525"),
            fk = jc && gc;
        k = ak.prototype;
        k.Ib = function(a) {
            if (hc || ec)
                if (17 == this.S && !a.ctrlKey || 18 == this.S && !a.altKey || jc && 91 == this.S && !a.metaKey) this.W = this.S = -1; - 1 == this.S && (a.ctrlKey && 17 != a.keyCode ? this.S = 17 : a.altKey && 18 != a.keyCode ? this.S = 18 : a.metaKey && 91 != a.keyCode && (this.S = 91));
            ek && !Ij(a.keyCode, this.S, a.shiftKey, a.ctrlKey, a.altKey, a.metaKey) ? this.handleEvent(a) : (this.W = Jj(a.keyCode), fk && (this.Ua = a.altKey))
        };
        k.Jb = function(a) {
            this.W =
                this.S = -1;
            this.Ua = a.altKey
        };
        k.handleEvent = function(a) {
            var b = a.a,
                c = b.altKey;
            if (z && "keypress" == a.type) {
                var d = this.W;
                var e = 13 != d && 27 != d ? b.keyCode : 0
            } else(hc || ec) && "keypress" == a.type ? (d = this.W, e = 0 <= b.charCode && 63232 > b.charCode && Hj(d) ? b.charCode : 0) : dc && !hc ? (d = this.W, e = Hj(d) ? b.keyCode : 0) : ("keypress" == a.type ? (fk && (c = this.Ua), b.keyCode == b.charCode ? 32 > b.keyCode ? (d = b.keyCode, e = 0) : (d = this.W, e = b.charCode) : (d = b.keyCode || this.W, e = b.charCode || 0)) : (d = b.keyCode || this.W, e = b.charCode || 0), jc && 63 == e && 224 == d && (d = 191));
            var f = d = Jj(d);
            d ? 63232 <= d && d in ck ? f = ck[d] : 25 == d && a.shiftKey && (f = 9) : b.keyIdentifier && b.keyIdentifier in dk && (f = dk[b.keyIdentifier]);
            gc && ek && "keypress" == a.type && !Ij(f, this.S, a.shiftKey, a.ctrlKey, c, a.metaKey) || (a = f == this.S, this.S = f, b = new gk(f, e, a, b), b.altKey = c, ze(this, b))
        };
        k.O = function() {
            return this.qa
        };

        function bk(a) {
            a.Na && (ve(a.Na), ve(a.Ya), ve(a.Oa), a.Na = null, a.Ya = null, a.Oa = null);
            a.qa = null;
            a.S = -1;
            a.W = -1
        }
        k.m = function() {
            ak.L.m.call(this);
            bk(this)
        };

        function gk(a, b, c, d) {
            ae.call(this, d);
            this.type = "key";
            this.keyCode = a;
            this.j = b;
            this.repeat = c
        }
        w(gk, ae);

        function hk(a, b, c, d) {
            this.top = a;
            this.right = b;
            this.bottom = c;
            this.left = d
        }
        hk.prototype.toString = function() {
            return "(" + this.top + "t, " + this.right + "r, " + this.bottom + "b, " + this.left + "l)"
        };
        hk.prototype.ceil = function() {
            this.top = Math.ceil(this.top);
            this.right = Math.ceil(this.right);
            this.bottom = Math.ceil(this.bottom);
            this.left = Math.ceil(this.left);
            return this
        };
        hk.prototype.floor = function() {
            this.top = Math.floor(this.top);
            this.right = Math.floor(this.right);
            this.bottom =
                Math.floor(this.bottom);
            this.left = Math.floor(this.left);
            return this
        };
        hk.prototype.round = function() {
            this.top = Math.round(this.top);
            this.right = Math.round(this.right);
            this.bottom = Math.round(this.bottom);
            this.left = Math.round(this.left);
            return this
        };

        function ik(a, b) {
            var c = Uc(a);
            return c.defaultView && c.defaultView.getComputedStyle && (a = c.defaultView.getComputedStyle(a, null)) ? a[b] || a.getPropertyValue(b) || "" : ""
        }

        function jk(a) {
            try {
                var b = a.getBoundingClientRect()
            } catch (c) {
                return {
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0
                }
            }
            z &&
                a.ownerDocument.body && (a = a.ownerDocument, b.left -= a.documentElement.clientLeft + a.body.clientLeft, b.top -= a.documentElement.clientTop + a.body.clientTop);
            return b
        }

        function kk(a, b) {
            b = b || $c(document);
            var c = b || $c(document);
            var d = lk(a),
                e = lk(c);
            if (!z || 9 <= Number(qc)) {
                g = ik(c, "borderLeftWidth");
                var f = ik(c, "borderRightWidth");
                h = ik(c, "borderTopWidth");
                l = ik(c, "borderBottomWidth");
                f = new hk(parseFloat(h), parseFloat(f), parseFloat(l), parseFloat(g))
            } else {
                var g = mk(c, "borderLeft");
                f = mk(c, "borderRight");
                var h = mk(c, "borderTop"),
                    l = mk(c, "borderBottom");
                f = new hk(h, f, l, g)
            }
            c == $c(document) ? (g = d.a - c.scrollLeft, d = d.g - c.scrollTop, !z || 10 <= Number(qc) || (g += f.left, d += f.top)) : (g = d.a - e.a - f.left, d = d.g - e.g - f.top);
            e = a.offsetWidth;
            f = a.offsetHeight;
            h = hc && !e && !f;
            ka(e) && !h || !a.getBoundingClientRect ? a = new Rc(e, f) : (a = jk(a), a = new Rc(a.right - a.left, a.bottom - a.top));
            e = c.clientHeight - a.height;
            f = c.scrollLeft;
            h = c.scrollTop;
            f += Math.min(g, Math.max(g - (c.clientWidth - a.width), 0));
            h += Math.min(d, Math.max(d - e, 0));
            c = new Qc(f, h);
            b.scrollLeft = c.a;
            b.scrollTop = c.g
        }

        function lk(a) {
            var b = Uc(a),
                c = new Qc(0, 0);
            var d = b ? Uc(b) : document;
            d = !z || 9 <= Number(qc) || "CSS1Compat" == Sc(d).a.compatMode ? d.documentElement : d.body;
            if (a == d) return c;
            a = jk(a);
            d = Sc(b).a;
            b = $c(d);
            d = d.parentWindow || d.defaultView;
            b = z && pc("10") && d.pageYOffset != b.scrollTop ? new Qc(b.scrollLeft, b.scrollTop) : new Qc(d.pageXOffset || b.scrollLeft, d.pageYOffset || b.scrollTop);
            c.a = a.left + b.a;
            c.g = a.top + b.g;
            return c
        }
        var nk = {
            thin: 2,
            medium: 4,
            thick: 6
        };

        function mk(a, b) {
            if ("none" == (a.currentStyle ? a.currentStyle[b + "Style"] : null)) return 0;
            var c = a.currentStyle ? a.currentStyle[b + "Width"] : null;
            if (c in nk) a = nk[c];
            else if (/^\d+px?$/.test(c)) a = parseInt(c, 10);
            else {
                b = a.style.left;
                var d = a.runtimeStyle.left;
                a.runtimeStyle.left = a.currentStyle.left;
                a.style.left = c;
                c = a.style.pixelLeft;
                a.style.left = b;
                a.runtimeStyle.left = d;
                a = +c
            }
            return a
        }

        function ok() {}
        oa(ok);
        ok.prototype.a = 0;

        function pk(a) {
            E.call(this);
            this.s = a || Sc();
            this.cb = null;
            this.na = !1;
            this.g = null;
            this.M = void 0;
            this.oa = this.Ca = this.X = null
        }
        w(pk, E);
        k = pk.prototype;
        k.Kb = ok.Xa();
        k.O = function() {
            return this.g
        };

        function M(a, b) {
            return a.g ? Xc(b, a.g || a.s.a) : null
        }

        function qk(a) {
            a.M || (a.M = new Tj(a));
            return a.M
        }
        k.Za = function(a) {
            if (this.X && this.X != a) throw Error("Method not supported");
            pk.L.Za.call(this, a)
        };
        k.kb = function() {
            this.g = this.s.a.createElement("DIV")
        };
        k.render = function(a) {
            if (this.na) throw Error("Component already rendered");
            this.g || this.kb();
            a ? a.insertBefore(this.g, null) : this.s.a.body.appendChild(this.g);
            this.X && !this.X.na || this.v()
        };
        k.v = function() {
            this.na = !0;
            rk(this, function(a) {
                !a.na && a.O() && a.v()
            })
        };
        k.ya = function() {
            rk(this, function(a) {
                a.na && a.ya()
            });
            this.M && Wj(this.M);
            this.na = !1
        };
        k.m = function() {
            this.na && this.ya();
            this.M && (this.M.o(), delete this.M);
            rk(this, function(a) {
                a.o()
            });
            this.g && ad(this.g);
            this.X = this.g = this.oa = this.Ca = null;
            pk.L.m.call(this)
        };

        function rk(a, b) {
            a.Ca && Ha(a.Ca, b, void 0)
        }
        k.removeChild = function(a, b) {
            if (a) {
                var c = q(a) ? a : a.cb || (a.cb = ":" + (a.Kb.a++).toString(36));
                this.oa && c ? (a = this.oa, a = (null !== a && c in a ? a[c] : void 0) || null) : a = null;
                if (c && a) {
                    var d = this.oa;
                    c in d && delete d[c];
                    Oa(this.Ca,
                        a);
                    b && (a.ya(), a.g && ad(a.g));
                    b = a;
                    if (null == b) throw Error("Unable to set parent component");
                    b.X = null;
                    pk.L.Za.call(b, null)
                }
            }
            if (!a) throw Error("Child is not in parent component");
            return a
        };

        function N(a, b) {
            var c = cd(a, "firebaseui-textfield");
            b ? (Dj(a, "firebaseui-input-invalid"), Cj(a, "firebaseui-input"), c && Dj(c, "firebaseui-textfield-invalid")) : (Dj(a, "firebaseui-input"), Cj(a, "firebaseui-input-invalid"), c && Cj(c, "firebaseui-textfield-invalid"))
        }

        function sk(a, b, c) {
            b = new Xj(b);
            Ud(a, ya(Vd, b));
            Vj(qk(a), b, "input",
                c)
        }

        function tk(a, b, c) {
            b = new ak(b);
            Ud(a, ya(Vd, b));
            Vj(qk(a), b, "key", function(d) {
                13 == d.keyCode && (d.stopPropagation(), d.preventDefault(), c(d))
            })
        }

        function uk(a, b, c) {
            b = new Pj(b);
            Ud(a, ya(Vd, b));
            Vj(qk(a), b, "focusin", c)
        }

        function vk(a, b, c) {
            b = new Pj(b);
            Ud(a, ya(Vd, b));
            Vj(qk(a), b, "focusout", c)
        }

        function O(a, b, c) {
            b = new Lj(b);
            Ud(a, ya(Vd, b));
            Vj(qk(a), b, "action", function(d) {
                d.stopPropagation();
                d.preventDefault();
                c(d)
            })
        }

        function wk(a) {
            Cj(a, "firebaseui-hidden")
        }

        function xk(a, b) {
            b && bd(a, b);
            Dj(a, "firebaseui-hidden")
        }

        function yk(a) {
            return !Bj(a,
                "firebaseui-hidden") && "none" != a.style.display
        }

        function zk(a) {
            a = a || {};
            var b = a.email,
                c = a.disabled,
                d = '<div class="firebaseui-textfield mdl-textfield mdl-js-textfield mdl-textfield--floating-label"><label class="mdl-textfield__label firebaseui-label" for="ui-sign-in-email-input">';
            d = a.vc ? d + "Enter new email address" : d + "Email";
            d += '</label><input type="email" name="email" id="ui-sign-in-email-input" autocomplete="username" class="mdl-textfield__input firebaseui-input firebaseui-id-email" value="' + wd(null !=
                b ? b : "") + '"' + (c ? "disabled" : "") + '></div><div class="firebaseui-error-wrapper"><p class="firebaseui-error firebaseui-text-input-error firebaseui-hidden firebaseui-id-email-error"></p></div>';
            return B(d)
        }

        function Ak(a) {
            a = a || {};
            a = a.label;
            var b = '<button type="submit" class="firebaseui-id-submit firebaseui-button mdl-button mdl-js-button mdl-button--raised mdl-button--colored">';
            b = a ? b + A(a) : b + "Next";
            return B(b + "</button>")
        }

        function Bk() {
            var a = "" + Ak({
                label: D("Sign In")
            });
            return B(a)
        }

        function Ck() {
            var a = "" +
                Ak({
                    label: D("Save")
                });
            return B(a)
        }

        function Dk() {
            var a = "" + Ak({
                label: D("Continue")
            });
            return B(a)
        }

        function Ek(a) {
            a = a || {};
            a = a.label;
            var b = '<div class="firebaseui-new-password-component"><div class="firebaseui-textfield mdl-textfield mdl-js-textfield mdl-textfield--floating-label"><label class="mdl-textfield__label firebaseui-label" for="ui-sign-in-new-password-input">';
            b = a ? b + A(a) : b + "Choose password";
            return B(b + '</label><input type="password" name="newPassword" id="ui-sign-in-new-password-input" autocomplete="new-password" class="mdl-textfield__input firebaseui-input firebaseui-id-new-password"></div><a href="javascript:void(0)" class="firebaseui-input-floating-button firebaseui-id-password-toggle firebaseui-input-toggle-on firebaseui-input-toggle-blur"></a><div class="firebaseui-error-wrapper"><p class="firebaseui-error firebaseui-text-input-error firebaseui-hidden firebaseui-id-new-password-error"></p></div></div>')
        }

        function Fk() {
            var a = {};
            var b = '<div class="firebaseui-textfield mdl-textfield mdl-js-textfield mdl-textfield--floating-label"><label class="mdl-textfield__label firebaseui-label" for="ui-sign-in-password-input">';
            b = a.current ? b + "Current password" : b + "Password";
            return B(b + '</label><input type="password" name="password" id="ui-sign-in-password-input" autocomplete="current-password" class="mdl-textfield__input firebaseui-input firebaseui-id-password"></div><div class="firebaseui-error-wrapper"><p class="firebaseui-error firebaseui-text-input-error firebaseui-hidden firebaseui-id-password-error"></p></div>')
        }

        function Gk() {
            return B('<a class="firebaseui-link firebaseui-id-secondary-link" href="javascript:void(0)">Trouble signing in?</a>')
        }

        function Hk(a) {
            a = a || {};
            a = a.label;
            var b = '<button class="firebaseui-id-secondary-link firebaseui-button mdl-button mdl-js-button mdl-button--primary">';
            b = a ? b + A(a) : b + "Cancel";
            return B(b + "</button>")
        }

        function Ik(a) {
            var b = "";
            a.G && a.F && (b += '<ul class="firebaseui-tos-list firebaseui-tos"><li class="firebaseui-inline-list-item"><a href="javascript:void(0)" class="firebaseui-link firebaseui-tos-link" target="_blank">Terms of Service</a></li><li class="firebaseui-inline-list-item"><a href="javascript:void(0)" class="firebaseui-link firebaseui-pp-link" target="_blank">Privacy Policy</a></li></ul>');
            return B(b)
        }

        function Jk(a) {
            var b = "";
            a.G && a.F && (b += '<p class="firebaseui-tos firebaseui-tospp-full-message">By continuing, you are indicating that you accept our <a href="javascript:void(0)" class="firebaseui-link firebaseui-tos-link" target="_blank">Terms of Service</a> and <a href="javascript:void(0)" class="firebaseui-link firebaseui-pp-link" target="_blank">Privacy Policy</a>.</p>');
            return B(b)
        }

        function Kk(a) {
            a = '<div class="firebaseui-info-bar firebaseui-id-info-bar"><p class="firebaseui-info-bar-message">' +
                A(a.message) + '&nbsp;&nbsp;<a href="javascript:void(0)" class="firebaseui-link firebaseui-id-dismiss-info-bar">Dismiss</a></p></div>';
            return B(a)
        }
        Kk.w = "firebaseui.auth.soy2.element.infoBar";

        function Lk(a) {
            var b = a.content;
            a = a.Ab;
            return B('<dialog class="mdl-dialog firebaseui-dialog firebaseui-id-dialog' + (a ? " " + wd(a) : "") + '">' + A(b) + "</dialog>")
        }

        function Mk(a) {
            var b = a.message;
            return B(Lk({
                content: vd('<div class="firebaseui-dialog-icon-wrapper"><div class="' + wd(a.La) + ' firebaseui-dialog-icon"></div></div><div class="firebaseui-progress-dialog-message">' +
                    A(b) + "</div>")
            }))
        }
        Mk.w = "firebaseui.auth.soy2.element.progressDialog";

        function Nk(a) {
            var b = '<div class="firebaseui-list-box-actions">';
            a = a.items;
            for (var c = a.length, d = 0; d < c; d++) {
                var e = a[d];
                b += '<button type="button" data-listboxid="' + wd(e.id) + '" class="mdl-button firebaseui-id-list-box-dialog-button firebaseui-list-box-dialog-button">' + (e.La ? '<div class="firebaseui-list-box-icon-wrapper"><div class="firebaseui-list-box-icon ' + wd(e.La) + '"></div></div>' : "") + '<div class="firebaseui-list-box-label-wrapper">' +
                    A(e.label) + "</div></button>"
            }
            b = "" + Lk({
                Ab: D("firebaseui-list-box-dialog"),
                content: vd(b + "</div>")
            });
            return B(b)
        }
        Nk.w = "firebaseui.auth.soy2.element.listBoxDialog";

        function Ok(a) {
            a = a || {};
            return B(a.ub ? '<div class="mdl-spinner mdl-spinner--single-color mdl-js-spinner is-active firebaseui-busy-indicator firebaseui-id-busy-indicator"></div>' : '<div class="mdl-progress mdl-js-progress mdl-progress__indeterminate firebaseui-busy-indicator firebaseui-id-busy-indicator"></div>')
        }
        Ok.w = "firebaseui.auth.soy2.element.busyIndicator";

        function Pk(a, b) {
            a = a || {};
            a = a.ga;
            return C(a.qb ? a.qb : b.hb[a.providerId] ? "" + b.hb[a.providerId] : 0 == ("" + a.providerId).indexOf("saml.") ? ("" + a.providerId).substring(5) : 0 == ("" + a.providerId).indexOf("oidc.") ? ("" + a.providerId).substring(5) : "" + a.providerId)
        }

        function Qk(a) {
            Rk(a, "upgradeElement")
        }

        function Sk(a) {
            Rk(a, "downgradeElements")
        }
        var Tk = ["mdl-js-textfield", "mdl-js-progress", "mdl-js-spinner", "mdl-js-button"];

        function Rk(a, b) {
            a && window.componentHandler && window.componentHandler[b] && Ha(Tk, function(c) {
                if (Bj(a,
                        c)) window.componentHandler[b](a);
                Ha(Vc(c, a), function(d) {
                    window.componentHandler[b](d)
                })
            })
        }

        function Uk(a, b, c) {
            Vk.call(this);
            document.body.appendChild(a);
            a.showModal || window.dialogPolyfill.registerDialog(a);
            a.showModal();
            Qk(a);
            b && O(this, a, function(f) {
                var g = a.getBoundingClientRect();
                (f.clientX < g.left || g.left + g.width < f.clientX || f.clientY < g.top || g.top + g.height < f.clientY) && Vk.call(this)
            });
            if (!c) {
                var d = this.O().parentElement || this.O().parentNode;
                if (d) {
                    var e = this;
                    this.da = function() {
                        if (a.open) {
                            var f = a.getBoundingClientRect().height,
                                g = d.getBoundingClientRect().height,
                                h = d.getBoundingClientRect().top - document.body.getBoundingClientRect().top,
                                l = d.getBoundingClientRect().left - document.body.getBoundingClientRect().left,
                                p = a.getBoundingClientRect().width,
                                r = d.getBoundingClientRect().width;
                            a.style.top = (h + (g - f) / 2).toString() + "px";
                            f = l + (r - p) / 2;
                            a.style.left = f.toString() + "px";
                            a.style.right = (document.body.getBoundingClientRect().width - f - p).toString() + "px"
                        } else window.removeEventListener("resize", e.da)
                    };
                    this.da();
                    window.addEventListener("resize",
                        this.da, !1)
                }
            }
        }

        function Vk() {
            var a = Wk.call(this);
            a && (Sk(a), a.open && a.close(), ad(a), this.da && window.removeEventListener("resize", this.da))
        }

        function Wk() {
            return Xc("firebaseui-id-dialog")
        }

        function Xk() {
            ad(Yk.call(this))
        }

        function Yk() {
            return M(this, "firebaseui-id-info-bar")
        }

        function Zk() {
            return M(this, "firebaseui-id-dismiss-info-bar")
        }
        var $k = {
            xa: {
                "google.com": "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg",
                "github.com": "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/github.svg",
                "facebook.com": "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/facebook.svg",
                "twitter.com": "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/twitter.svg",
                password: "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/mail.svg",
                phone: "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/phone.svg",
                anonymous: "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png",
                "microsoft.com": "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/microsoft.svg",
                "yahoo.com": "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/yahoo.svg",
                "apple.com": "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/apple.png",
                saml: "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/saml.svg",
                oidc: "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/oidc.svg"
            },
            wa: {
                "google.com": "#ffffff",
                "github.com": "#333333",
                "facebook.com": "#3b5998",
                "twitter.com": "#55acee",
                password: "#db4437",
                phone: "#02bd7e",
                anonymous: "#f4b400",
                "microsoft.com": "#2F2F2F",
                "yahoo.com": "#720E9E",
                "apple.com": "#000000",
                saml: "#007bff",
                oidc: "#007bff"
            },
            hb: {
                "google.com": "Google",
                "github.com": "GitHub",
                "facebook.com": "Facebook",
                "twitter.com": "Twitter",
                password: "Password",
                phone: "Phone",
                anonymous: "Guest",
                "microsoft.com": "Microsoft",
                "yahoo.com": "Yahoo",
                "apple.com": "Apple"
            }
        };

        function al(a, b, c) {
            $d.call(this, a, b);
            for (var d in c) this[d] = c[d]
        }
        w(al, $d);

        function P(a, b, c, d, e) {
            pk.call(this, c);
            this.fb = a;
            this.eb = b;
            this.Da = !1;
            this.Ea = d || null;
            this.B = this.ca = null;
            this.Y = gb($k);
            ib(this.Y, e || {})
        }
        w(P, pk);
        k = P.prototype;
        k.kb = function() {
            var a = jd(this.fb, this.eb, this.Y, this.s);
            Qk(a);
            this.g = a
        };
        k.v =
            function() {
                P.L.v.call(this);
                De(Q(this), new al("pageEnter", Q(this), {
                    pageId: this.Ea
                }));
                if (this.bb() && this.Y.G) {
                    var a = this.Y.G;
                    O(this, this.bb(), function() {
                        a()
                    })
                }
                if (this.ab() && this.Y.F) {
                    var b = this.Y.F;
                    O(this, this.ab(), function() {
                        b()
                    })
                }
            };
        k.ya = function() {
            De(Q(this), new al("pageExit", Q(this), {
                pageId: this.Ea
            }));
            P.L.ya.call(this)
        };
        k.m = function() {
            window.clearTimeout(this.ca);
            this.eb = this.fb = this.ca = null;
            this.Da = !1;
            this.B = null;
            Sk(this.O());
            P.L.m.call(this)
        };

        function bl(a) {
            a.Da = !0;
            var b = Bj(a.O(), "firebaseui-use-spinner");
            a.ca = window.setTimeout(function() {
                a.O() && null === a.B && (a.B = jd(Ok, {
                    ub: b
                }, null, a.s), a.O().appendChild(a.B), Qk(a.B))
            }, 500)
        }
        k.J = function(a, b, c, d) {
            function e() {
                if (f.T) return null;
                f.Da = !1;
                window.clearTimeout(f.ca);
                f.ca = null;
                f.B && (Sk(f.B), ad(f.B), f.B = null)
            }
            var f = this;
            if (f.Da) return null;
            bl(f);
            return a.apply(null, b).then(c, d).then(e, e)
        };

        function Q(a) {
            return a.O().parentElement || a.O().parentNode
        }

        function cl(a, b, c) {
            tk(a, b, function() {
                c.focus()
            })
        }

        function dl(a, b, c) {
            tk(a, b, function() {
                c()
            })
        }
        u(P.prototype, {
            a: function(a) {
                Xk.call(this);
                var b = jd(Kk, {
                    message: a
                }, null, this.s);
                this.O().appendChild(b);
                O(this, Zk.call(this), function() {
                    ad(b)
                })
            },
            xc: Xk,
            zc: Yk,
            yc: Zk,
            Z: function(a, b) {
                a = jd(Mk, {
                    La: a,
                    message: b
                }, null, this.s);
                Uk.call(this, a)
            },
            h: Vk,
            Cb: Wk,
            Bc: function() {
                return M(this, "firebaseui-tos")
            },
            bb: function() {
                return M(this, "firebaseui-tos-link")
            },
            ab: function() {
                return M(this, "firebaseui-pp-link")
            },
            Cc: function() {
                return M(this, "firebaseui-tos-list")
            }
        });

        function el(a, b, c) {
            a = a || {};
            b = a.Va;
            var d = a.ia;
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-sign-in"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Sign in with email</h1></div><div class="firebaseui-card-content"><div class="firebaseui-relative-wrapper">' +
                zk(a) + '</div></div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">' + (b ? Hk(null) : "") + Ak(null) + '</div></div><div class="firebaseui-card-footer">' + (d ? Jk(c) : Ik(c)) + "</div></form></div>";
            return B(a)
        }
        el.w = "firebaseui.auth.soy2.page.signIn";

        function fl(a, b, c) {
            a = a || {};
            b = a.ia;
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-password-sign-in"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Sign in</h1></div><div class="firebaseui-card-content">' +
                zk(a) + Fk() + '</div><div class="firebaseui-card-actions"><div class="firebaseui-form-links">' + Gk() + '</div><div class="firebaseui-form-actions">' + Bk() + '</div></div><div class="firebaseui-card-footer">' + (b ? Jk(c) : Ik(c)) + "</div></form></div>";
            return B(a)
        }
        fl.w = "firebaseui.auth.soy2.page.passwordSignIn";

        function gl(a, b, c) {
            a = a || {};
            var d = a.Sb;
            b = a.Ta;
            var e = a.ia,
                f = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-password-sign-up"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Create account</h1></div><div class="firebaseui-card-content">' +
                zk(a);
            d ? (a = a || {}, a = a.name, a = '<div class="firebaseui-textfield mdl-textfield mdl-js-textfield mdl-textfield--floating-label"><label class="mdl-textfield__label firebaseui-label" for="ui-sign-in-name-input">First &amp; last name</label><input type="text" name="name" id="ui-sign-in-name-input" autocomplete="name" class="mdl-textfield__input firebaseui-input firebaseui-id-name" value="' + wd(null != a ? a : "") + '"></div><div class="firebaseui-error-wrapper"><p class="firebaseui-error firebaseui-text-input-error firebaseui-hidden firebaseui-id-name-error"></p></div>',
                a = B(a)) : a = "";
            c = f + a + Ek(null) + '</div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">' + (b ? Hk(null) : "") + Ck() + '</div></div><div class="firebaseui-card-footer">' + (e ? Jk(c) : Ik(c)) + "</div></form></div>";
            return B(c)
        }
        gl.w = "firebaseui.auth.soy2.page.passwordSignUp";

        function hl(a, b, c) {
            a = a || {};
            b = a.Ta;
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-password-recovery"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Recover password</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">Get instructions sent to this email that explain how to reset your password</p>' +
                zk(a) + '</div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">' + (b ? Hk(null) : "") + Ak({
                    label: D("Send")
                }) + '</div></div><div class="firebaseui-card-footer">' + Ik(c) + "</div></form></div>";
            return B(a)
        }
        hl.w = "firebaseui.auth.soy2.page.passwordRecovery";

        function il(a, b, c) {
            b = a.H;
            var d = "";
            a = "Follow the instructions sent to <strong>" + (A(a.email) + "</strong> to recover your password");
            d += '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-password-recovery-email-sent"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Check your email</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">' +
                a + '</p></div><div class="firebaseui-card-actions">';
            b && (d += '<div class="firebaseui-form-actions">' + Ak({
                label: D("Done")
            }) + "</div>");
            d += '</div><div class="firebaseui-card-footer">' + Ik(c) + "</div></div>";
            return B(d)
        }
        il.w = "firebaseui.auth.soy2.page.passwordRecoveryEmailSent";

        function jl(a, b, c) {
            return B('<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-callback"><div class="firebaseui-callback-indicator-container">' + Ok(null, null, c) + "</div></div>")
        }
        jl.w = "firebaseui.auth.soy2.page.callback";

        function kl(a, b, c) {
            return B('<div class="firebaseui-container firebaseui-id-page-spinner">' + Ok({
                ub: !0
            }, null, c) + "</div>")
        }
        kl.w = "firebaseui.auth.soy2.page.spinner";

        function ll() {
            return B('<div class="firebaseui-container firebaseui-id-page-blank firebaseui-use-spinner"></div>')
        }
        ll.w = "firebaseui.auth.soy2.page.blank";

        function ml(a, b, c) {
            b = "";
            a = "A sign-in email with additional instructions was sent to <strong>" + (A(a.email) + "</strong>. Check your email to complete sign-in.");
            var d = B('<a class="firebaseui-link firebaseui-id-trouble-getting-email-link" href="javascript:void(0)">Trouble getting email?</a>');
            b += '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-email-link-sign-in-sent"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Sign-in email sent</h1></div><div class="firebaseui-card-content"><div class="firebaseui-email-sent"></div><p class="firebaseui-text">' + a + '</p></div><div class="firebaseui-card-actions"><div class="firebaseui-form-links">' + d + '</div><div class="firebaseui-form-actions">' + Hk({
                    label: D("Back")
                }) + '</div></div><div class="firebaseui-card-footer">' +
                Ik(c) + "</div></form></div>";
            return B(b)
        }
        ml.w = "firebaseui.auth.soy2.page.emailLinkSignInSent";

        function nl(a, b, c) {
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-email-not-received"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Trouble getting email?</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">Try these common fixes:<ul><li>Check if the email was marked as spam or filtered.</li><li>Check your internet connection.</li><li>Check that you did not misspell your email.</li><li>Check that your inbox space is not running out or other inbox settings related issues.</li></ul></p><p class="firebaseui-text">If the steps above didn\'t work, you can resend the email. Note that this will deactivate the link in the older email.</p></div><div class="firebaseui-card-actions"><div class="firebaseui-form-links">' +
                B('<a class="firebaseui-link firebaseui-id-resend-email-link" href="javascript:void(0)">Resend</a>') + '</div><div class="firebaseui-form-actions">' + Hk({
                    label: D("Back")
                }) + '</div></div><div class="firebaseui-card-footer">' + Ik(c) + "</div></form></div>";
            return B(a)
        }
        nl.w = "firebaseui.auth.soy2.page.emailNotReceived";

        function ol(a, b, c) {
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-email-link-sign-in-confirmation"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Confirm email</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">Confirm your email to complete sign in</p><div class="firebaseui-relative-wrapper">' +
                zk(a) + '</div></div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">' + Hk(null) + Ak(null) + '</div></div><div class="firebaseui-card-footer">' + Ik(c) + "</div></form></div>";
            return B(a)
        }
        ol.w = "firebaseui.auth.soy2.page.emailLinkSignInConfirmation";

        function pl() {
            var a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-different-device-error"><div class="firebaseui-card-header"><h1 class="firebaseui-title">New device or browser detected</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">Try opening the link using the same device or browser where you started the sign-in process.</p></div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">' +
                Hk({
                    label: D("Dismiss")
                }) + "</div></div></div>";
            return B(a)
        }
        pl.w = "firebaseui.auth.soy2.page.differentDeviceError";

        function ql() {
            var a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-anonymous-user-mismatch"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Session ended</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">The session associated with this sign-in request has either expired or was cleared.</p></div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">' +
                Hk({
                    label: D("Dismiss")
                }) + "</div></div></div>";
            return B(a)
        }
        ql.w = "firebaseui.auth.soy2.page.anonymousUserMismatch";

        function rl(a, b, c) {
            b = "";
            a = "You\u2019ve already used <strong>" + (A(a.email) + "</strong> to sign in. Enter your password for that account.");
            b += '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-password-linking"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Sign in</h1></div><div class="firebaseui-card-content"><h2 class="firebaseui-subtitle">You already have an account</h2><p class="firebaseui-text">' +
                a + "</p>" + Fk() + '</div><div class="firebaseui-card-actions"><div class="firebaseui-form-links">' + Gk() + '</div><div class="firebaseui-form-actions">' + Bk() + '</div></div><div class="firebaseui-card-footer">' + Ik(c) + "</div></form></div>";
            return B(b)
        }
        rl.w = "firebaseui.auth.soy2.page.passwordLinking";

        function sl(a, b, c) {
            var d = a.email;
            b = "";
            a = "" + Pk(a, c);
            a = D(a);
            d = "You\u2019ve already used <strong>" + (A(d) + ("</strong>. You can connect your <strong>" + (A(a) + ("</strong> account with <strong>" + (A(d) + "</strong> by signing in with email link below.")))));
            a = "For this flow to successfully connect your " + (A(a) + " account with this email, you have to open the link on the same device or browser.");
            b += '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-email-link-sign-in-linking"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Sign in</h1></div><div class="firebaseui-card-content"><h2 class="firebaseui-subtitle">You already have an account</h2><p class="firebaseui-text firebaseui-text-justify">' +
                d + '<p class="firebaseui-text firebaseui-text-justify">' + a + '</p></div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">' + Bk() + '</div></div><div class="firebaseui-card-footer">' + Ik(c) + "</div></form></div>";
            return B(b)
        }
        sl.w = "firebaseui.auth.soy2.page.emailLinkSignInLinking";

        function tl(a, b, c) {
            b = "";
            var d = "" + Pk(a, c);
            d = D(d);
            a = "You originally intended to connect <strong>" + (A(d) + "</strong> to your email account but have opened the link on a different device where you are not signed in.");
            d = "If you still want to connect your <strong>" + (A(d) + "</strong> account, open the link on the same device where you started sign-in. Otherwise, tap Continue to sign-in on this device.");
            b += '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-email-link-sign-in-linking-different-device"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Sign in</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text firebaseui-text-justify">' +
                a + '</p><p class="firebaseui-text firebaseui-text-justify">' + d + '</p></div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">' + Dk() + '</div></div><div class="firebaseui-card-footer">' + Ik(c) + "</div></form></div>";
            return B(b)
        }
        tl.w = "firebaseui.auth.soy2.page.emailLinkSignInLinkingDifferentDevice";

        function ul(a, b, c) {
            var d = a.email;
            b = "";
            a = "" + Pk(a, c);
            a = D(a);
            d = "You\u2019ve already used <strong>" + (A(d) + ("</strong>. Sign in with " + (A(a) + " to continue.")));
            b += '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-federated-linking"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Sign in</h1></div><div class="firebaseui-card-content"><h2 class="firebaseui-subtitle">You already have an account</h2><p class="firebaseui-text">' +
                d + '</p></div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">' + Ak({
                    label: D("Sign in with " + a)
                }) + '</div></div><div class="firebaseui-card-footer">' + Ik(c) + "</div></form></div>";
            return B(b)
        }
        ul.w = "firebaseui.auth.soy2.page.federatedLinking";

        function vl(a, b, c) {
            b = "";
            a = "To continue sign in with <strong>" + (A(a.email) + "</strong> on this device, you have to recover the password.");
            b += '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-unsupported-provider"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Sign in</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">' +
                a + '</p></div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">' + Hk(null) + Ak({
                    label: D("Recover password")
                }) + '</div></div><div class="firebaseui-card-footer">' + Ik(c) + "</div></form></div>";
            return B(b)
        }
        vl.w = "firebaseui.auth.soy2.page.unsupportedProvider";

        function wl(a) {
            var b = "",
                c = '<p class="firebaseui-text">for <strong>' + (A(a.email) + "</strong></p>");
            b += '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-password-reset"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Reset your password</h1></div><div class="firebaseui-card-content">' +
                c + Ek(ud(a)) + '</div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">' + Ck() + "</div></div></form></div>";
            return B(b)
        }
        wl.w = "firebaseui.auth.soy2.page.passwordReset";

        function xl(a) {
            a = a || {};
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-password-reset-success"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Password changed</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">You can now sign in with your new password</p></div><div class="firebaseui-card-actions">' +
                (a.H ? '<div class="firebaseui-form-actions">' + Dk() + "</div>" : "") + "</div></div>";
            return B(a)
        }
        xl.w = "firebaseui.auth.soy2.page.passwordResetSuccess";

        function yl(a) {
            a = a || {};
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-password-reset-failure"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Try resetting your password again</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">Your request to reset your password has expired or the link has already been used</p></div><div class="firebaseui-card-actions">' +
                (a.H ? '<div class="firebaseui-form-actions">' + Dk() + "</div>" : "") + "</div></div>";
            return B(a)
        }
        yl.w = "firebaseui.auth.soy2.page.passwordResetFailure";

        function zl(a) {
            var b = a.H,
                c = "";
            a = "Your sign-in email address has been changed back to <strong>" + (A(a.email) + "</strong>.");
            c += '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-email-change-revoke-success"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Updated email address</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">' +
                a + '</p><p class="firebaseui-text">If you didn\u2019t ask to change your sign-in email, it\u2019s possible someone is trying to access your account and you should <a class="firebaseui-link firebaseui-id-reset-password-link" href="javascript:void(0)">change your password right away</a>.</p></div><div class="firebaseui-card-actions">' + (b ? '<div class="firebaseui-form-actions">' + Dk() + "</div>" : "") + "</div></form></div>";
            return B(c)
        }
        zl.w = "firebaseui.auth.soy2.page.emailChangeRevokeSuccess";

        function Al(a) {
            a =
                a || {};
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-email-change-revoke-failure"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Unable to update your email address</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">There was a problem changing your sign-in email back.</p><p class="firebaseui-text">If you try again and still can\u2019t reset your email, try asking your administrator for help.</p></div><div class="firebaseui-card-actions">' +
                (a.H ? '<div class="firebaseui-form-actions">' + Dk() + "</div>" : "") + "</div></div>";
            return B(a)
        }
        Al.w = "firebaseui.auth.soy2.page.emailChangeRevokeFailure";

        function Bl(a) {
            a = a || {};
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-email-verification-success"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Your email has been verified</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">You can now sign in with your new account</p></div><div class="firebaseui-card-actions">' +
                (a.H ? '<div class="firebaseui-form-actions">' + Dk() + "</div>" : "") + "</div></div>";
            return B(a)
        }
        Bl.w = "firebaseui.auth.soy2.page.emailVerificationSuccess";

        function Cl(a) {
            a = a || {};
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-email-verification-failure"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Try verifying your email again</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">Your request to verify your email has expired or the link has already been used</p></div><div class="firebaseui-card-actions">' +
                (a.H ? '<div class="firebaseui-form-actions">' + Dk() + "</div>" : "") + "</div></div>";
            return B(a)
        }
        Cl.w = "firebaseui.auth.soy2.page.emailVerificationFailure";

        function El(a) {
            var b = a.H,
                c = "";
            a = "You can now sign in with your new email <strong>" + (A(a.email) + "</strong>.");
            c += '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-verify-and-change-email-success"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Your email has been verified and changed</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">' +
                a + '</p></div><div class="firebaseui-card-actions">' + (b ? '<div class="firebaseui-form-actions">' + Dk() + "</div>" : "") + "</div></div>";
            return B(c)
        }
        El.w = "firebaseui.auth.soy2.page.verifyAndChangeEmailSuccess";

        function Fl(a) {
            a = a || {};
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-verify-and-change-email-failure"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Try updating your email again</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">Your request to verify and update your email has expired or the link has already been used.</p></div><div class="firebaseui-card-actions">' +
                (a.H ? '<div class="firebaseui-form-actions">' + Dk() + "</div>" : "") + "</div></div>";
            return B(a)
        }
        Fl.w = "firebaseui.auth.soy2.page.verifyAndChangeEmailFailure";

        function Gl(a) {
            var b = a.factorId,
                c = a.phoneNumber;
            a = a.H;
            var d = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-revert-second-factor-addition-success"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Removed second factor</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">';
            switch (b) {
                case "phone":
                    b = "The <strong>" + (A(b) + (" " + (A(c) + "</strong> was removed as a second authentication step.")));
                    d += b;
                    break;
                default:
                    d += "The device or app was removed as a second authentication step."
            }
            d += '</p><p class="firebaseui-text">If you don\'t recognize this device, someone might be trying to access your account. Consider <a class="firebaseui-link firebaseui-id-reset-password-link" href="javascript:void(0)">changing your password right away</a>.</p></div><div class="firebaseui-card-actions">' +
                (a ? '<div class="firebaseui-form-actions">' + Dk() + "</div>" : "") + "</div></form></div>";
            return B(d)
        }
        Gl.w = "firebaseui.auth.soy2.page.revertSecondFactorAdditionSuccess";

        function Hl(a) {
            a = a || {};
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-revert-second-factor-addition-failure"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Couldn\'t remove your second factor</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">Something went wrong removing your second factor.</p><p class="firebaseui-text">Try removing it again. If that doesn\'t work, contact support for assistance.</p></div><div class="firebaseui-card-actions">' +
                (a.H ? '<div class="firebaseui-form-actions">' + Dk() + "</div>" : "") + "</div></div>";
            return B(a)
        }
        Hl.w = "firebaseui.auth.soy2.page.revertSecondFactorAdditionFailure";

        function Il(a) {
            var b = a.zb;
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-recoverable-error"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Error encountered</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">' + A(a.errorMessage) + '</p></div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">';
            b && (a += Ak({
                label: D("Retry")
            }));
            return B(a + "</div></div></div>")
        }
        Il.w = "firebaseui.auth.soy2.page.recoverableError";

        function Jl(a) {
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-unrecoverable-error"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Error encountered</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">' + A(a.errorMessage) + "</p></div></div>";
            return B(a)
        }
        Jl.w = "firebaseui.auth.soy2.page.unrecoverableError";

        function Kl(a,
            b, c) {
            var d = a.Pb;
            b = "";
            a = "Continue with " + (A(a.ic) + "?");
            d = "You originally wanted to sign in with " + A(d);
            b += '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-email-mismatch"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Sign in</h1></div><div class="firebaseui-card-content"><h2 class="firebaseui-subtitle">' + a + '</h2><p class="firebaseui-text">' + d + '</p></div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">' +
                Hk(null) + Ak({
                    label: D("Continue")
                }) + '</div></div><div class="firebaseui-card-footer">' + Ik(c) + "</div></form></div>";
            return B(b)
        }
        Kl.w = "firebaseui.auth.soy2.page.emailMismatch";

        function Ll(a, b, c) {
            var d = '<div class="firebaseui-container firebaseui-page-provider-sign-in firebaseui-id-page-provider-sign-in firebaseui-use-spinner"><div class="firebaseui-card-content"><form onsubmit="return false;"><ul class="firebaseui-idp-list">';
            a = a.Rb;
            b = a.length;
            for (var e = 0; e < b; e++) {
                var f = {
                    ga: a[e]
                };
                var g = c;
                f = f || {};
                var h =
                    f.ga,
                    l = f;
                l = l || {};
                var p = "";
                switch (l.ga.providerId) {
                    case "google.com":
                        p += "firebaseui-idp-google";
                        break;
                    case "github.com":
                        p += "firebaseui-idp-github";
                        break;
                    case "facebook.com":
                        p += "firebaseui-idp-facebook";
                        break;
                    case "twitter.com":
                        p += "firebaseui-idp-twitter";
                        break;
                    case "phone":
                        p += "firebaseui-idp-phone";
                        break;
                    case "anonymous":
                        p += "firebaseui-idp-anonymous";
                        break;
                    case "password":
                        p += "firebaseui-idp-password";
                        break;
                    default:
                        p += "firebaseui-idp-generic"
                }
                l = '<button class="firebaseui-idp-button mdl-button mdl-js-button mdl-button--raised ' +
                    wd(C(p)) + ' firebaseui-id-idp-button" data-provider-id="' + wd(h.providerId) + '" style="background-color:';
                p = (p = f) || {};
                p = p.ga;
                l = l + wd(Fd(C(p.Ga ? p.Ga : g.wa[p.providerId] ? "" + g.wa[p.providerId] : 0 == p.providerId.indexOf("saml.") ? "" + g.wa.saml : 0 == p.providerId.indexOf("oidc.") ? "" + g.wa.oidc : "" + g.wa.password))) + '"><span class="firebaseui-idp-icon-wrapper"><img class="firebaseui-idp-icon" alt="" src="';
                var r = f;
                p = g;
                r = r || {};
                r = r.ga;
                p = rd(r.Ma ? Bd(r.Ma) : p.xa[r.providerId] ? Bd(p.xa[r.providerId]) : 0 == r.providerId.indexOf("saml.") ?
                    Bd(p.xa.saml) : 0 == r.providerId.indexOf("oidc.") ? Bd(p.xa.oidc) : Bd(p.xa.password));
                l = l + wd(Bd(p)) + '"></span>';
                "password" == h.providerId ? l += '<span class="firebaseui-idp-text firebaseui-idp-text-long">Sign in with email</span><span class="firebaseui-idp-text firebaseui-idp-text-short">Email</span>' : "phone" == h.providerId ? l += '<span class="firebaseui-idp-text firebaseui-idp-text-long">Sign in with phone</span><span class="firebaseui-idp-text firebaseui-idp-text-short">Phone</span>' : "anonymous" == h.providerId ?
                    l += '<span class="firebaseui-idp-text firebaseui-idp-text-long">Continue as guest</span><span class="firebaseui-idp-text firebaseui-idp-text-short">Guest</span>' : (h = "Sign in with " + A(Pk(f, g)), l += '<span class="firebaseui-idp-text firebaseui-idp-text-long">' + h + '</span><span class="firebaseui-idp-text firebaseui-idp-text-short">' + A(Pk(f, g)) + "</span>");
                f = B(l + "</button>");
                d += '<li class="firebaseui-list-item">' + f + "</li>"
            }
            d += '</ul></form></div><div class="firebaseui-card-footer firebaseui-provider-sign-in-footer">' +
                Jk(c) + "</div></div>";
            return B(d)
        }
        Ll.w = "firebaseui.auth.soy2.page.providerSignIn";

        function Ml(a, b, c) {
            a = a || {};
            var d = a.Fb,
                e = a.Va;
            b = a.ia;
            a = a || {};
            a = a.za;
            a = '<div class="firebaseui-phone-number"><button class="firebaseui-id-country-selector firebaseui-country-selector mdl-button mdl-js-button"><span class="firebaseui-flag firebaseui-country-selector-flag firebaseui-id-country-selector-flag"></span><span class="firebaseui-id-country-selector-code"></span></button><div class="mdl-textfield mdl-js-textfield mdl-textfield--floating-label firebaseui-textfield firebaseui-phone-input-wrapper"><label class="mdl-textfield__label firebaseui-label" for="ui-sign-in-phone-number-input">Phone number</label><input type="tel" name="phoneNumber" id="ui-sign-in-phone-number-input" class="mdl-textfield__input firebaseui-input firebaseui-id-phone-number" value="' +
                wd(null != a ? a : "") + '"></div></div><div class="firebaseui-error-wrapper"><p class="firebaseui-error firebaseui-text-input-error firebaseui-hidden firebaseui-phone-number-error firebaseui-id-phone-number-error"></p></div>';
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-phone-sign-in-start"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Enter your phone number</h1></div><div class="firebaseui-card-content"><div class="firebaseui-relative-wrapper">' +
                B(a);
            var f;
            d ? f = B('<div class="firebaseui-recaptcha-wrapper"><div class="firebaseui-recaptcha-container"></div><div class="firebaseui-error-wrapper firebaseui-recaptcha-error-wrapper"><p class="firebaseui-error firebaseui-hidden firebaseui-id-recaptcha-error"></p></div></div>') : f = "";
            f = a + f + '</div></div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">' + (e ? Hk(null) : "") + Ak({
                label: D("Verify")
            }) + '</div></div><div class="firebaseui-card-footer">';
            b ? (b = '<p class="firebaseui-tos firebaseui-phone-tos">',
                    b = c.G && c.F ? b + 'By tapping Verify, you are indicating that you accept our <a href="javascript:void(0)" class="firebaseui-link firebaseui-tos-link" target="_blank">Terms of Service</a> and <a href="javascript:void(0)" class="firebaseui-link firebaseui-pp-link" target="_blank">Privacy Policy</a>. An SMS may be sent. Message &amp; data rates may apply.' : b + "By tapping Verify, an SMS may be sent. Message &amp; data rates may apply.", c = B(b + "</p>")) : c = B('<p class="firebaseui-tos firebaseui-phone-sms-notice">By tapping Verify, an SMS may be sent. Message &amp; data rates may apply.</p>') +
                Ik(c);
            return B(f + c + "</div></form></div>")
        }
        Ml.w = "firebaseui.auth.soy2.page.phoneSignInStart";

        function Nl(a, b, c) {
            a = a || {};
            b = a.phoneNumber;
            var d = "";
            a = 'Enter the 6-digit code we sent to <a class="firebaseui-link firebaseui-change-phone-number-link firebaseui-id-change-phone-number-link" href="javascript:void(0)">&lrm;' + (A(b) + "</a>");
            A(b);
            b = d;
            d = B('<div class="firebaseui-textfield mdl-textfield mdl-js-textfield mdl-textfield--floating-label"><label class="mdl-textfield__label firebaseui-label" for="ui-sign-in-phone-confirmation-code-input">6-digit code</label><input type="number" name="phoneConfirmationCode" id="ui-sign-in-phone-confirmation-code-input" class="mdl-textfield__input firebaseui-input firebaseui-id-phone-confirmation-code"></div><div class="firebaseui-error-wrapper"><p class="firebaseui-error firebaseui-text-input-error firebaseui-hidden firebaseui-id-phone-confirmation-code-error"></p></div>');
            c = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-phone-sign-in-finish"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Verify your phone number</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">' + a + "</p>" + d + '</div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">' + Hk(null) + Ak({
                label: D("Continue")
            }) + '</div></div><div class="firebaseui-card-footer">' + Ik(c) + "</div></form>";
            a = B('<div class="firebaseui-resend-container"><span class="firebaseui-id-resend-countdown"></span><a href="javascript:void(0)" class="firebaseui-id-resend-link firebaseui-hidden firebaseui-link">Resend</a></div>');
            return B(b + (c + a + "</div>"))
        }
        Nl.w = "firebaseui.auth.soy2.page.phoneSignInFinish";

        function Ol() {
            return B('<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-sign-out"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Sign Out</h1></div><div class="firebaseui-card-content"><p class="firebaseui-text">You are now successfully signed out.</p></div></div>')
        }
        Ol.w = "firebaseui.auth.soy2.page.signOut";

        function Pl(a, b, c) {
            var d = '<div class="firebaseui-container firebaseui-page-select-tenant firebaseui-id-page-select-tenant"><div class="firebaseui-card-content"><form onsubmit="return false;"><ul class="firebaseui-tenant-list">';
            a = a.dc;
            b = a.length;
            for (var e = 0; e < b; e++) {
                var f = a[e];
                var g = "",
                    h = "Sign in to " + A(f.displayName),
                    l = A(f.displayName),
                    p = f.tenantId ? f.tenantId : "top-level-project";
                p = D(p);
                g += '<button class="firebaseui-tenant-button mdl-button mdl-js-button mdl-button--raised firebaseui-tenant-selection-' +
                    wd(p) + ' firebaseui-id-tenant-selection-button"' + (f.tenantId ? 'data-tenant-id="' + wd(f.tenantId) + '"' : "") + 'style="background-color:' + wd(Fd(f.Ga)) + '"><span class="firebaseui-idp-icon-wrapper"><img class="firebaseui-idp-icon" alt="" src="' + wd(Bd(f.Ma)) + '"></span><span class="firebaseui-idp-text firebaseui-idp-text-long">' + h + '</span><span class="firebaseui-idp-text firebaseui-idp-text-short">' + l + "</span></button>";
                f = B(g);
                d += '<li class="firebaseui-list-item">' + f + "</li>"
            }
            d += '</ul></form></div><div class="firebaseui-card-footer firebaseui-provider-sign-in-footer">' +
                Jk(c) + "</div></div>";
            return B(d)
        }
        Pl.w = "firebaseui.auth.soy2.page.selectTenant";

        function Ql(a, b, c) {
            a = '<div class="mdl-card mdl-shadow--2dp firebaseui-container firebaseui-id-page-provider-match-by-email"><form onsubmit="return false;"><div class="firebaseui-card-header"><h1 class="firebaseui-title">Sign in</h1></div><div class="firebaseui-card-content"><div class="firebaseui-relative-wrapper">' + zk(null) + '</div></div><div class="firebaseui-card-actions"><div class="firebaseui-form-actions">' + Ak(null) +
                '</div></div><div class="firebaseui-card-footer">' + Jk(c) + "</div></form></div>";
            return B(a)
        }
        Ql.w = "firebaseui.auth.soy2.page.providerMatchByEmail";

        function Rl() {
            return M(this, "firebaseui-id-submit")
        }

        function Sl() {
            return M(this, "firebaseui-id-secondary-link")
        }

        function Tl(a, b) {
            O(this, Rl.call(this), function(d) {
                a(d)
            });
            var c = Sl.call(this);
            c && b && O(this, c, function(d) {
                b(d)
            })
        }

        function Ul() {
            return M(this, "firebaseui-id-password")
        }

        function Vl() {
            return M(this, "firebaseui-id-password-error")
        }

        function Wl() {
            var a =
                Ul.call(this),
                b = Vl.call(this);
            sk(this, a, function() {
                yk(b) && (N(a, !0), wk(b))
            })
        }

        function Xl() {
            var a = Ul.call(this);
            var b = Vl.call(this);
            Ej(a) ? (N(a, !0), wk(b), b = !0) : (N(a, !1), xk(b, C("Enter your password").toString()), b = !1);
            return b ? Ej(a) : null
        }

        function Yl(a, b, c, d, e, f) {
            P.call(this, rl, {
                email: a
            }, f, "passwordLinking", {
                G: d,
                F: e
            });
            this.A = b;
            this.I = c
        }
        m(Yl, P);
        Yl.prototype.v = function() {
            this.R();
            this.N(this.A, this.I);
            dl(this, this.i(), this.A);
            this.i().focus();
            P.prototype.v.call(this)
        };
        Yl.prototype.m = function() {
            this.A = null;
            P.prototype.m.call(this)
        };
        Yl.prototype.j = function() {
            return Ej(M(this, "firebaseui-id-email"))
        };
        u(Yl.prototype, {
            i: Ul,
            C: Vl,
            R: Wl,
            u: Xl,
            ea: Rl,
            ba: Sl,
            N: Tl
        });
        var Zl = /^[+a-zA-Z0-9_.!#$%&'*\/=?^`{|}~-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z0-9]{2,63}$/;

        function $l() {
            return M(this, "firebaseui-id-email")
        }

        function am() {
            return M(this, "firebaseui-id-email-error")
        }

        function bm(a) {
            var b = $l.call(this),
                c = am.call(this);
            sk(this, b, function() {
                yk(c) && (N(b, !0), wk(c))
            });
            a && tk(this, b, function() {
                a()
            })
        }

        function cm() {
            return Wa(Ej($l.call(this)) ||
                "")
        }

        function dm() {
            var a = $l.call(this);
            var b = am.call(this);
            var c = Ej(a) || "";
            c ? Zl.test(c) ? (N(a, !0), wk(b), b = !0) : (N(a, !1), xk(b, C("That email address isn't correct").toString()), b = !1) : (N(a, !1), xk(b, C("Enter your email address to continue").toString()), b = !1);
            return b ? Wa(Ej(a)) : null
        }

        function em(a, b, c, d, e, f, g) {
            P.call(this, fl, {
                email: c,
                ia: !!f
            }, g, "passwordSignIn", {
                G: d,
                F: e
            });
            this.A = a;
            this.I = b
        }
        m(em, P);
        em.prototype.v = function() {
            this.R();
            this.ea();
            this.ba(this.A, this.I);
            cl(this, this.l(), this.i());
            dl(this, this.i(),
                this.A);
            Ej(this.l()) ? this.i().focus() : this.l().focus();
            P.prototype.v.call(this)
        };
        em.prototype.m = function() {
            this.I = this.A = null;
            P.prototype.m.call(this)
        };
        u(em.prototype, {
            l: $l,
            U: am,
            R: bm,
            N: cm,
            j: dm,
            i: Ul,
            C: Vl,
            ea: Wl,
            u: Xl,
            ua: Rl,
            pa: Sl,
            ba: Tl
        });

        function R(a, b, c, d, e, f) {
            P.call(this, a, b, d, e || "notice", f);
            this.i = c || null
        }
        w(R, P);
        R.prototype.v = function() {
            this.i && (this.u(this.i), this.l().focus());
            R.L.v.call(this)
        };
        R.prototype.m = function() {
            this.i = null;
            R.L.m.call(this)
        };
        u(R.prototype, {
            l: Rl,
            A: Sl,
            u: Tl
        });

        function fm(a, b,
            c, d, e) {
            R.call(this, il, {
                email: a,
                H: !!b
            }, b, e, "passwordRecoveryEmailSent", {
                G: c,
                F: d
            })
        }
        w(fm, R);

        function gm(a, b) {
            R.call(this, Bl, {
                H: !!a
            }, a, b, "emailVerificationSuccess")
        }
        w(gm, R);

        function hm(a, b) {
            R.call(this, Cl, {
                H: !!a
            }, a, b, "emailVerificationFailure")
        }
        w(hm, R);

        function im(a, b, c) {
            R.call(this, El, {
                email: a,
                H: !!b
            }, b, c, "verifyAndChangeEmailSuccess")
        }
        w(im, R);

        function jm(a, b) {
            R.call(this, Fl, {
                H: !!a
            }, a, b, "verifyAndChangeEmailFailure")
        }
        w(jm, R);

        function km(a, b) {
            R.call(this, Hl, {
                H: !!a
            }, a, b, "revertSecondFactorAdditionFailure")
        }
        w(km, R);

        function lm(a) {
            R.call(this, Ol, void 0, void 0, a, "signOut")
        }
        w(lm, R);

        function mm(a, b) {
            R.call(this, xl, {
                H: !!a
            }, a, b, "passwordResetSuccess")
        }
        w(mm, R);

        function nm(a, b) {
            R.call(this, yl, {
                H: !!a
            }, a, b, "passwordResetFailure")
        }
        w(nm, R);

        function om(a, b) {
            R.call(this, Al, {
                H: !!a
            }, a, b, "emailChangeRevokeFailure")
        }
        w(om, R);

        function pm(a, b, c) {
            R.call(this, Il, {
                errorMessage: a,
                zb: !!b
            }, b, c, "recoverableError")
        }
        w(pm, R);

        function qm(a, b) {
            R.call(this, Jl, {
                errorMessage: a
            }, void 0, b, "unrecoverableError")
        }
        w(qm, R);
        var rm = !1,
            sm = null;

        function tm(a, b) {
            rm = !!b;
            sm || ("undefined" == typeof accountchooser && zj() ? (b = zc(vc(new sc(tc, "//www.gstatic.com/accountchooser/client.js"))), sm = G(Kf(b)).ta(function() {})) : sm = G());
            sm.then(a, a)
        }

        function um(a, b) {
            a = S(a);
            (a = Wi(a).accountChooserInvoked || null) ? a(b): b()
        }

        function vm(a, b, c) {
            a = S(a);
            (a = Wi(a).accountChooserResult || null) ? a(b, c): c()
        }

        function wm(a, b, c, d, e) {
            d ? (L("callback", a, b), rm && c()) : um(a, function() {
                Qh(new Gg(a.a.tenantId || null), T(a));
                kj(function(f) {
                    Fh(yh, T(a));
                    vm(a, f ? "empty" : "unavailable", function() {
                        L("signIn",
                            a, b);
                        (f || rm) && c()
                    })
                }, Kh(T(a)), e)
            })
        }

        function xm(a, b, c, d) {
            function e(f) {
                f = U(f);
                V(b, c, void 0, f);
                d()
            }
            vm(b, "accountSelected", function() {
                Jh(!1, T(b));
                var f = ym(b);
                W(b, X(b).fetchSignInMethodsForEmail(a.a).then(function(g) {
                    zm(b, c, g, a.a, a.h || void 0, void 0, f);
                    d()
                }, e))
            })
        }

        function Am(a, b, c, d) {
            vm(b, a ? "addAccount" : "unavailable", function() {
                L("signIn", b, c);
                (a || rm) && d()
            })
        }

        function Bm(a, b, c, d) {
            function e() {
                var f = a();
                f && (f = Vi(S(f))) && f()
            }
            hj(function() {
                    var f = a();
                    f && wm(f, b, e, c, d)
                }, function(f) {
                    var g = a();
                    g && xm(f, g, b, e)
                },
                function(f) {
                    var g = a();
                    g && Am(f, g, b, e)
                }, a() && qi(S(a())))
        }

        function Cm(a, b, c, d) {
            function e(g) {
                if (!g.name || "cancel" != g.name) {
                    a: {
                        var h = g.message;
                        try {
                            var l = ((JSON.parse(h).error || {}).message || "").toLowerCase().match(/invalid.+(access|id)_token/);
                            if (l && l.length) {
                                var p = !0;
                                break a
                            }
                        } catch (r) {}
                        p = !1
                    }
                    if (p) g = Q(b),
                    b.o(),
                    V(a, g, void 0, C("Your sign-in session has expired. Please try again.").toString());
                    else {
                        p = g && g.message || "";
                        if (g.code) {
                            if ("auth/email-already-in-use" == g.code || "auth/credential-already-in-use" == g.code) return;
                            p = U(g)
                        }
                        b.a(p)
                    }
                }
            }
            Dm(a);
            if (d) return Em(a, c), G();
            if (!c.credential) throw Error("No credential found!");
            d = X(a).currentUser || c.user;
            if (!d) throw Error("User not logged in.");
            d = new xg(d.email, d.displayName, d.photoURL, "password" == c.credential.providerId ? null : c.credential.providerId);
            null != Eh(Ah, T(a)) && !Eh(Ah, T(a)) || Lh(d, T(a));
            Fh(Ah, T(a));
            try {
                var f = Fm(a, c)
            } catch (g) {
                return rg(g.code || g.message, g), b.a(g.code || g.message), G()
            }
            c = f.then(function(g) {
                Em(a, g)
            }, e).then(void 0, e);
            W(a, f);
            return G(c)
        }

        function Em(a, b) {
            if (!b.user) throw Error("No user found");
            var c = Yi(S(a));
            Xi(S(a)) && c && wg("Both signInSuccess and signInSuccessWithAuthResult callbacks are provided. Only signInSuccessWithAuthResult callback will be invoked.");
            if (c) {
                c = Yi(S(a));
                var d = Hh(T(a)) || void 0;
                Fh(zh, T(a));
                var e = !1;
                if (sf()) {
                    if (!c || c(b, d)) e = !0, window.opener.location.assign(Cc(Fc(Gm(a, d))));
                    c || window.close()
                } else if (!c || c(b, d)) e = !0, rf(Gm(a, d));
                e || a.reset()
            } else {
                c = b.user;
                b = b.credential;
                d = Xi(S(a));
                e = Hh(T(a)) || void 0;
                Fh(zh, T(a));
                var f = !1;
                if (sf()) {
                    if (!d || d(c, b, e)) f = !0, window.opener.location.assign(Cc(Fc(Gm(a,
                        e))));
                    d || window.close()
                } else if (!d || d(c, b, e)) f = !0, rf(Gm(a, e));
                f || a.reset()
            }
        }

        function Gm(a, b) {
            a = b || S(a).a.get("signInSuccessUrl");
            if (!a) throw Error("No redirect URL has been found. You must either specify a signInSuccessUrl in the configuration, pass in a redirect URL to the widget URL, or return false from the callback.");
            return a
        }

        function U(a) {
            var b = {
                code: a.code
            };
            b = b || {};
            var c = "";
            switch (b.code) {
                case "auth/email-already-in-use":
                    c += "The email address is already used by another account";
                    break;
                case "auth/requires-recent-login":
                    c +=
                        Od();
                    break;
                case "auth/too-many-requests":
                    c += "You have entered an incorrect password too many times. Please try again in a few minutes.";
                    break;
                case "auth/user-cancelled":
                    c += "Please authorize the required permissions to sign in to the application";
                    break;
                case "auth/user-not-found":
                    c += "That email address doesn't match an existing account";
                    break;
                case "auth/user-token-expired":
                    c += Od();
                    break;
                case "auth/weak-password":
                    c += "Strong passwords have at least 6 characters and a mix of letters and numbers";
                    break;
                case "auth/wrong-password":
                    c += "The email and password you entered don't match";
                    break;
                case "auth/network-request-failed":
                    c += "A network error has occurred";
                    break;
                case "auth/invalid-phone-number":
                    c += Jd();
                    break;
                case "auth/invalid-verification-code":
                    c += C("Wrong code. Try again.");
                    break;
                case "auth/code-expired":
                    c += "This code is no longer valid";
                    break;
                case "auth/expired-action-code":
                    c += "This code has expired.";
                    break;
                case "auth/invalid-action-code":
                    c += "The action code is invalid. This can happen if the code is malformed, expired, or has already been used."
            }
            if (b =
                C(c).toString()) return b;
            try {
                return JSON.parse(a.message), rg("Internal error: " + a.message, void 0), Ld().toString()
            } catch (d) {
                return a.message
            }
        }

        function Hm(a, b, c) {
            var d = ni[b] && firebase.auth[ni[b]] ? new firebase.auth[ni[b]] : 0 == b.indexOf("saml.") ? new firebase.auth.SAMLAuthProvider(b) : new firebase.auth.OAuthProvider(b);
            if (!d) throw Error("Invalid Firebase Auth provider!");
            var e = Hi(S(a), b);
            if (d.addScope)
                for (var f = 0; f < e.length; f++) d.addScope(e[f]);
            e = Ii(S(a), b) || {};
            c && (b == firebase.auth.GoogleAuthProvider.PROVIDER_ID ?
                a = "login_hint" : b == firebase.auth.GithubAuthProvider.PROVIDER_ID ? a = "login" : a = (a = zi(S(a), b)) && a.Nb, a && (e[a] = c));
            d.setCustomParameters && d.setCustomParameters(e);
            return d
        }

        function Im(a, b, c, d) {
            function e() {
                Qh(new Gg(a.a.tenantId || null), T(a));
                W(a, b.J(t(a.cc, a), [l], function() {
                    if ("file:" === (window.location && window.location.protocol)) return W(a, Jm(a).then(function(p) {
                        b.o();
                        Fh(yh, T(a));
                        L("callback", a, h, G(p))
                    }, f))
                }, g))
            }

            function f(p) {
                Fh(yh, T(a));
                if (!p.name || "cancel" != p.name) switch (p.code) {
                    case "auth/popup-blocked":
                        e();
                        break;
                    case "auth/popup-closed-by-user":
                    case "auth/cancelled-popup-request":
                        break;
                    case "auth/credential-already-in-use":
                        break;
                    case "auth/network-request-failed":
                    case "auth/too-many-requests":
                    case "auth/user-cancelled":
                        b.a(U(p));
                        break;
                    default:
                        b.o(), L("callback", a, h, ef(p))
                }
            }

            function g(p) {
                Fh(yh, T(a));
                p.name && "cancel" == p.name || (rg("signInWithRedirect: " + p.code, void 0), p = U(p), "blank" == b.Ea && Ri(S(a)) ? (b.o(), L("providerSignIn", a, h, p)) : b.a(p))
            }
            var h = Q(b),
                l = Hm(a, c, d);
            Si(S(a)) == Ti ? e() : W(a, Km(a, l).then(function(p) {
                b.o();
                L("callback", a, h, G(p))
            }, f))
        }

        function Lm(a, b) {
            W(a, b.J(t(a.Zb, a), [], function(c) {
                b.o();
                return Cm(a, b, c, !0)
            }, function(c) {
                c.name && "cancel" == c.name || (rg("ContinueAsGuest: " + c.code, void 0), c = U(c), b.a(c))
            }))
        }

        function Mm(a, b, c) {
            function d(f) {
                var g = !1;
                f = b.J(t(a.$b, a), [f], function(h) {
                    var l = Q(b);
                    b.o();
                    L("callback", a, l, G(h));
                    g = !0
                }, function(h) {
                    if (!h.name || "cancel" != h.name)
                        if (!h || "auth/credential-already-in-use" != h.code)
                            if (h && "auth/email-already-in-use" == h.code && h.email && h.credential) {
                                var l = Q(b);
                                b.o();
                                L("callback",
                                    a, l, ef(h))
                            } else h = U(h), b.a(h)
                });
                W(a, f);
                return f.then(function() {
                    return g
                }, function() {
                    return !1
                })
            }
            if (c && c.credential && c.clientId === Ci(S(a))) {
                if (Hi(S(a), firebase.auth.GoogleAuthProvider.PROVIDER_ID).length) {
                    try {
                        var e = JSON.parse(atob(c.credential.split(".")[1])).email
                    } catch (f) {}
                    Im(a, b, firebase.auth.GoogleAuthProvider.PROVIDER_ID, e);
                    return G(!0)
                }
                return d(firebase.auth.GoogleAuthProvider.credential(c.credential))
            }
            c && b.a(C("The selected credential for the authentication provider is not supported!").toString());
            return G(!1)
        }

        function Nm(a, b) {
            var c = b.j(),
                d = b.u();
            if (c)
                if (d) {
                    var e = firebase.auth.EmailAuthProvider.credential(c, d);
                    W(a, b.J(t(a.ac, a), [c, d], function(f) {
                        return Cm(a, b, {
                            user: f.user,
                            credential: e,
                            operationType: f.operationType,
                            additionalUserInfo: f.additionalUserInfo
                        })
                    }, function(f) {
                        if (!f.name || "cancel" != f.name) switch (f.code) {
                            case "auth/email-already-in-use":
                                break;
                            case "auth/email-exists":
                                N(b.l(), !1);
                                xk(b.U(), U(f));
                                break;
                            case "auth/too-many-requests":
                            case "auth/wrong-password":
                                N(b.i(), !1);
                                xk(b.C(), U(f));
                                break;
                            default:
                                rg("verifyPassword: " + f.message, void 0), b.a(U(f))
                        }
                    }))
                } else b.i().focus();
            else b.l().focus()
        }

        function ym(a) {
            a = yi(S(a));
            return 1 == a.length && a[0] == firebase.auth.EmailAuthProvider.PROVIDER_ID
        }

        function Om(a) {
            a = yi(S(a));
            return 1 == a.length && a[0] == firebase.auth.PhoneAuthProvider.PROVIDER_ID
        }

        function V(a, b, c, d) {
            ym(a) ? d ? L("signIn", a, b, c, d) : Pm(a, b, c) : a && Om(a) && !d ? L("phoneSignInStart", a, b) : a && Ri(S(a)) && !d ? L("federatedRedirect", a, b, c) : L("providerSignIn", a, b, d, c)
        }

        function Qm(a, b, c, d) {
            var e = Q(b);
            W(a,
                b.J(t(X(a).fetchSignInMethodsForEmail, X(a)), [c], function(f) {
                    Jh(Di(S(a)) == pi, T(a));
                    b.o();
                    zm(a, e, f, c, void 0, d)
                }, function(f) {
                    f = U(f);
                    b.a(f)
                }))
        }

        function zm(a, b, c, d, e, f, g) {
            c.length || Oi(S(a)) ? !c.length && Oi(S(a)) ? L("sendEmailLinkForSignIn", a, b, d, function() {
                L("signIn", a, b)
            }) : Na(c, firebase.auth.EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD) ? L("passwordSignIn", a, b, d, g) : 1 == c.length && c[0] === firebase.auth.EmailAuthProvider.EMAIL_LINK_SIGN_IN_METHOD ? Oi(S(a)) ? L("sendEmailLinkForSignIn", a, b, d, function() {
                L("signIn",
                    a, b)
            }) : L("unsupportedProvider", a, b, d) : (c = li(c, yi(S(a)))) ? (Oh(new Eg(d), T(a)), L("federatedSignIn", a, b, d, c, f)) : L("unsupportedProvider", a, b, d) : L("passwordSignUp", a, b, d, e, void 0, g)
        }

        function Rm(a, b, c, d, e, f) {
            var g = Q(b);
            W(a, b.J(t(a.Hb, a), [c, f], function() {
                b.o();
                L("emailLinkSignInSent", a, g, c, d, f)
            }, e))
        }

        function Pm(a, b, c) {
            Di(S(a)) == pi ? tm(function() {
                fj ? um(a, function() {
                    Qh(new Gg(a.a.tenantId || null), T(a));
                    kj(function(d) {
                        Fh(yh, T(a));
                        vm(a, d ? "empty" : "unavailable", function() {
                            c ? L("prefilledEmailSignIn", a, b, c) : L("signIn",
                                a, b)
                        })
                    }, Kh(T(a)), ri(S(a)))
                }) : (Y(a), Bm(Sm, b, !1, ri(S(a))))
            }, !1) : (rm = !1, um(a, function() {
                vm(a, "unavailable", function() {
                    c ? L("prefilledEmailSignIn", a, b, c) : L("signIn", a, b)
                })
            }))
        }

        function Tm(a) {
            var b = vf();
            a = ti(S(a));
            b = vb(b, a) || "";
            for (var c in aj)
                if (aj[c].toLowerCase() == b.toLowerCase()) return aj[c];
            return "callback"
        }

        function Um(a) {
            var b = vf();
            a = Wh(S(a).a, "queryParameterForSignInSuccessUrl");
            return (b = vb(b, a)) ? Cc(Fc(b)) : null
        }

        function Vm() {
            return vb(vf(), "oobCode")
        }

        function Wm() {
            var a = vb(vf(), "continueUrl");
            return a ?
                function() {
                    rf(a)
                } : null
        }

        function Xm(a, b) {
            var c = uf(b, "Could not find the FirebaseUI widget element on the page.");
            b = Um(a);
            switch (Tm(a)) {
                case "callback":
                    b && Ih(b, T(a));
                    a.nb() ? L("callback", a, c) : V(a, c, Ym(a));
                    break;
                case "resetPassword":
                    L("passwordReset", a, c, Vm(), Wm());
                    break;
                case "recoverEmail":
                    L("emailChangeRevocation", a, c, Vm());
                    break;
                case "revertSecondFactorAddition":
                    L("revertSecondFactorAddition", a, c, Vm());
                    break;
                case "verifyEmail":
                    L("emailVerification", a, c, Vm(), Wm());
                    break;
                case "verifyAndChangeEmail":
                    L("verifyAndChangeEmail",
                        a, c, Vm(), Wm());
                    break;
                case "signIn":
                    L("emailLinkSignInCallback", a, c, vf());
                    Zm();
                    break;
                case "select":
                    if (b && Ih(b, T(a)), fj) {
                        V(a, c);
                        break
                    } else {
                        tm(function() {
                            Y(a);
                            Bm(Sm, c, !0)
                        }, !0);
                        return
                    }
                    default:
                        throw Error("Unhandled widget operation.");
            }(b = Vi(S(a))) && b()
        }

        function $m(a, b) {
            P.call(this, ql, void 0, b, "anonymousUserMismatch");
            this.i = a
        }
        m($m, P);
        $m.prototype.v = function() {
            var a = this;
            O(this, this.l(), function() {
                a.i()
            });
            this.l().focus();
            P.prototype.v.call(this)
        };
        $m.prototype.m = function() {
            this.i = null;
            P.prototype.m.call(this)
        };
        u($m.prototype, {
            l: Sl
        });
        J.anonymousUserMismatch = function(a, b) {
            var c = new $m(function() {
                c.o();
                V(a, b)
            });
            c.render(b);
            Z(a, c)
        };

        function an(a) {
            P.call(this, jl, void 0, a, "callback")
        }
        m(an, P);
        an.prototype.J = function(a, b, c, d) {
            return a.apply(null, b).then(c, d)
        };

        function bn(a, b, c) {
            if (c.user) {
                var d = {
                        user: c.user,
                        credential: c.credential,
                        operationType: c.operationType,
                        additionalUserInfo: c.additionalUserInfo
                    },
                    e = Mh(T(a)),
                    f = e && e.g;
                if (f && !cn(c.user, f)) dn(a, b, d);
                else {
                    var g = e && e.a;
                    g ? W(a, c.user.linkWithCredential(g).then(function(h) {
                        d = {
                            user: h.user,
                            credential: g,
                            operationType: h.operationType,
                            additionalUserInfo: h.additionalUserInfo
                        };
                        en(a, b, d)
                    }, function(h) {
                        fn(a, b, h)
                    })) : en(a, b, d)
                }
            } else c = Q(b), b.o(), Nh(T(a)), V(a, c)
        }

        function en(a, b, c) {
            Nh(T(a));
            Cm(a, b, c)
        }

        function fn(a, b, c) {
            var d = Q(b);
            Nh(T(a));
            c = U(c);
            b.o();
            V(a, d, void 0, c)
        }

        function gn(a, b, c, d) {
            var e = Q(b);
            W(a, X(a).fetchSignInMethodsForEmail(c).then(function(f) {
                b.o();
                f.length ? Na(f, firebase.auth.EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD) ? L("passwordLinking", a, e, c) : 1 == f.length && f[0] ===
                    firebase.auth.EmailAuthProvider.EMAIL_LINK_SIGN_IN_METHOD ? L("emailLinkSignInLinking", a, e, c) : (f = li(f, yi(S(a)))) ? L("federatedLinking", a, e, c, f, d) : (Nh(T(a)), L("unsupportedProvider", a, e, c)) : (Nh(T(a)), L("passwordRecovery", a, e, c, !1, Md().toString()))
            }, function(f) {
                fn(a, b, f)
            }))
        }

        function dn(a, b, c) {
            var d = Q(b);
            W(a, hn(a).then(function() {
                b.o();
                L("emailMismatch", a, d, c)
            }, function(e) {
                e.name && "cancel" == e.name || (e = U(e.code), b.a(e))
            }))
        }

        function cn(a, b) {
            if (b == a.email) return !0;
            if (a.providerData)
                for (var c = 0; c < a.providerData.length; c++)
                    if (b ==
                        a.providerData[c].email) return !0;
            return !1
        }
        J.callback = function(a, b, c) {
            var d = new an;
            d.render(b);
            Z(a, d);
            b = c || Jm(a);
            W(a, b.then(function(e) {
                bn(a, d, e)
            }, function(e) {
                if (e && ("auth/account-exists-with-different-credential" == e.code || "auth/email-already-in-use" == e.code) && e.email && e.credential) Oh(new Eg(e.email, e.credential), T(a)), gn(a, d, e.email);
                else if (e && "auth/user-cancelled" == e.code) {
                    var f = Mh(T(a)),
                        g = U(e);
                    f && f.a ? gn(a, d, f.g, g) : f ? Qm(a, d, f.g, g) : fn(a, d, e)
                } else e && "auth/credential-already-in-use" == e.code || (e &&
                    "auth/operation-not-supported-in-this-environment" == e.code && ym(a) ? bn(a, d, {
                        user: null,
                        credential: null
                    }) : fn(a, d, e))
            }))
        };

        function jn(a, b) {
            P.call(this, pl, void 0, b, "differentDeviceError");
            this.i = a
        }
        m(jn, P);
        jn.prototype.v = function() {
            var a = this;
            O(this, this.l(), function() {
                a.i()
            });
            this.l().focus();
            P.prototype.v.call(this)
        };
        jn.prototype.m = function() {
            this.i = null;
            P.prototype.m.call(this)
        };
        u(jn.prototype, {
            l: Sl
        });
        J.differentDeviceError = function(a, b) {
            var c = new jn(function() {
                c.o();
                V(a, b)
            });
            c.render(b);
            Z(a, c)
        };

        function kn(a,
            b, c, d) {
            P.call(this, zl, {
                email: a,
                H: !!c
            }, d, "emailChangeRevoke");
            this.l = b;
            this.i = c || null
        }
        m(kn, P);
        kn.prototype.v = function() {
            var a = this;
            O(this, M(this, "firebaseui-id-reset-password-link"), function() {
                a.l()
            });
            this.i && (this.A(this.i), this.u().focus());
            P.prototype.v.call(this)
        };
        kn.prototype.m = function() {
            this.l = this.i = null;
            P.prototype.m.call(this)
        };
        u(kn.prototype, {
            u: Rl,
            C: Sl,
            A: Tl
        });

        function ln() {
            return M(this, "firebaseui-id-new-password")
        }

        function mn() {
            return M(this, "firebaseui-id-password-toggle")
        }

        function nn() {
            this.Ra = !this.Ra;
            var a = mn.call(this),
                b = ln.call(this);
            this.Ra ? (b.type = "text", Cj(a, "firebaseui-input-toggle-off"), Dj(a, "firebaseui-input-toggle-on")) : (b.type = "password", Cj(a, "firebaseui-input-toggle-on"), Dj(a, "firebaseui-input-toggle-off"));
            b.focus()
        }

        function on() {
            return M(this, "firebaseui-id-new-password-error")
        }

        function pn() {
            this.Ra = !1;
            var a = ln.call(this);
            a.type = "password";
            var b = on.call(this);
            sk(this, a, function() {
                yk(b) && (N(a, !0), wk(b))
            });
            var c = mn.call(this);
            Cj(c, "firebaseui-input-toggle-on");
            Dj(c, "firebaseui-input-toggle-off");
            uk(this, a, function() {
                Cj(c, "firebaseui-input-toggle-focus");
                Dj(c, "firebaseui-input-toggle-blur")
            });
            vk(this, a, function() {
                Cj(c, "firebaseui-input-toggle-blur");
                Dj(c, "firebaseui-input-toggle-focus")
            });
            O(this, c, t(nn, this))
        }

        function qn() {
            var a = ln.call(this);
            var b = on.call(this);
            Ej(a) ? (N(a, !0), wk(b), b = !0) : (N(a, !1), xk(b, C("Enter your password").toString()), b = !1);
            return b ? Ej(a) : null
        }

        function rn(a, b, c) {
            P.call(this, wl, {
                email: a
            }, c, "passwordReset");
            this.l = b
        }
        m(rn, P);
        rn.prototype.v = function() {
            this.I();
            this.C(this.l);
            dl(this, this.i(), this.l);
            this.i().focus();
            P.prototype.v.call(this)
        };
        rn.prototype.m = function() {
            this.l = null;
            P.prototype.m.call(this)
        };
        u(rn.prototype, {
            i: ln,
            A: on,
            N: mn,
            I: pn,
            u: qn,
            U: Rl,
            R: Sl,
            C: Tl
        });

        function sn(a, b, c, d, e) {
            P.call(this, Gl, {
                factorId: a,
                phoneNumber: c || null,
                H: !!d
            }, e, "revertSecondFactorAdditionSuccess");
            this.l = b;
            this.i = d || null
        }
        m(sn, P);
        sn.prototype.v = function() {
            var a = this;
            O(this, M(this, "firebaseui-id-reset-password-link"), function() {
                a.l()
            });
            this.i && (this.A(this.i), this.u().focus());
            P.prototype.v.call(this)
        };
        sn.prototype.m = function() {
            this.l = this.i = null;
            P.prototype.m.call(this)
        };
        u(sn.prototype, {
            u: Rl,
            C: Sl,
            A: Tl
        });

        function tn(a, b, c, d, e) {
            var f = c.u();
            f && W(a, c.J(t(X(a).confirmPasswordReset, X(a)), [d, f], function() {
                c.o();
                var g = new mm(e);
                g.render(b);
                Z(a, g)
            }, function(g) {
                un(a, b, c, g)
            }))
        }

        function un(a, b, c, d) {
            "auth/weak-password" == (d && d.code) ? (a = U(d), N(c.i(), !1), xk(c.A(), a), c.i().focus()) : (c && c.o(), c = new nm, c.render(b), Z(a, c))
        }

        function vn(a, b, c) {
            var d = new kn(c, function() {
                W(a, d.J(t(X(a).sendPasswordResetEmail, X(a)), [c],
                    function() {
                        d.o();
                        d = new fm(c, void 0, I(S(a)), Mi(S(a)));
                        d.render(b);
                        Z(a, d)
                    },
                    function() {
                        d.a(Kd().toString())
                    }))
            });
            d.render(b);
            Z(a, d)
        }

        function wn(a, b, c, d) {
            var e = new sn(d.factorId, function() {
                e.J(t(X(a).sendPasswordResetEmail, X(a)), [c], function() {
                    e.o();
                    e = new fm(c, void 0, I(S(a)), Mi(S(a)));
                    e.render(b);
                    Z(a, e)
                }, function() {
                    e.a(Kd().toString())
                })
            }, d.phoneNumber);
            e.render(b);
            Z(a, e)
        }
        J.passwordReset = function(a, b, c, d) {
            W(a, X(a).verifyPasswordResetCode(c).then(function(e) {
                var f = new rn(e, function() {
                    tn(a, b, f, c, d)
                });
                f.render(b);
                Z(a, f)
            }, function() {
                un(a, b)
            }))
        };
        J.emailChangeRevocation = function(a, b, c) {
            var d = null;
            W(a, X(a).checkActionCode(c).then(function(e) {
                d = e.data.email;
                return X(a).applyActionCode(c)
            }).then(function() {
                vn(a, b, d)
            }, function() {
                var e = new om;
                e.render(b);
                Z(a, e)
            }))
        };
        J.emailVerification = function(a, b, c, d) {
            W(a, X(a).applyActionCode(c).then(function() {
                var e = new gm(d);
                e.render(b);
                Z(a, e)
            }, function() {
                var e = new hm;
                e.render(b);
                Z(a, e)
            }))
        };
        J.revertSecondFactorAddition = function(a, b, c) {
            var d = null,
                e = null;
            W(a, X(a).checkActionCode(c).then(function(f) {
                d =
                    f.data.email;
                e = f.data.multiFactorInfo;
                return X(a).applyActionCode(c)
            }).then(function() {
                wn(a, b, d, e)
            }, function() {
                var f = new km;
                f.render(b);
                Z(a, f)
            }))
        };
        J.verifyAndChangeEmail = function(a, b, c, d) {
            var e = null;
            W(a, X(a).checkActionCode(c).then(function(f) {
                e = f.data.email;
                return X(a).applyActionCode(c)
            }).then(function() {
                var f = new im(e, d);
                f.render(b);
                Z(a, f)
            }, function() {
                var f = new jm;
                f.render(b);
                Z(a, f)
            }))
        };

        function xn(a, b) {
            try {
                var c = "number" == typeof a.selectionStart
            } catch (d) {
                c = !1
            }
            c ? (a.selectionStart = b, a.selectionEnd =
                b) : z && !pc("9") && ("textarea" == a.type && (b = a.value.substring(0, b).replace(/(\r\n|\r|\n)/g, "\n").length), a = a.createTextRange(), a.collapse(!0), a.move("character", b), a.select())
        }

        function yn(a, b, c, d, e, f) {
            P.call(this, ol, {
                email: c
            }, f, "emailLinkSignInConfirmation", {
                G: d,
                F: e
            });
            this.l = a;
            this.u = b
        }
        m(yn, P);
        yn.prototype.v = function() {
            this.A(this.l);
            this.C(this.l, this.u);
            this.i().focus();
            xn(this.i(), (this.i().value || "").length);
            P.prototype.v.call(this)
        };
        yn.prototype.m = function() {
            this.u = this.l = null;
            P.prototype.m.call(this)
        };
        u(yn.prototype, {
            i: $l,
            N: am,
            A: bm,
            I: cm,
            j: dm,
            U: Rl,
            R: Sl,
            C: Tl
        });
        J.emailLinkConfirmation = function(a, b, c, d, e, f) {
            var g = new yn(function() {
                var h = g.j();
                h ? (g.o(), d(a, b, h, c)) : g.i().focus()
            }, function() {
                g.o();
                V(a, b, e || void 0)
            }, e || void 0, I(S(a)), Mi(S(a)));
            g.render(b);
            Z(a, g);
            f && g.a(f)
        };

        function zn(a, b, c, d, e) {
            P.call(this, tl, {
                ga: a
            }, e, "emailLinkSignInLinkingDifferentDevice", {
                G: c,
                F: d
            });
            this.i = b
        }
        m(zn, P);
        zn.prototype.v = function() {
            this.u(this.i);
            this.l().focus();
            P.prototype.v.call(this)
        };
        zn.prototype.m = function() {
            this.i =
                null;
            P.prototype.m.call(this)
        };
        u(zn.prototype, {
            l: Rl,
            u: Tl
        });
        J.emailLinkNewDeviceLinking = function(a, b, c, d) {
            var e = new Sb(c);
            c = e.a.a.get(x.PROVIDER_ID) || null;
            Wb(e, null);
            if (c) {
                var f = new zn(zi(S(a), c), function() {
                    f.o();
                    d(a, b, e.toString())
                }, I(S(a)), Mi(S(a)));
                f.render(b);
                Z(a, f)
            } else V(a, b)
        };

        function An(a) {
            P.call(this, ll, void 0, a, "blank")
        }
        m(An, P);

        function Bn(a, b, c, d, e) {
            var f = new An,
                g = new Sb(c),
                h = g.a.a.get(x.$a) || "",
                l = g.a.a.get(x.Sa) || "",
                p = "1" === g.a.a.get(x.Qa),
                r = Vb(g),
                K = g.a.a.get(x.PROVIDER_ID) || null;
            g = g.a.a.get(x.wb) ||
                null;
            Cn(a, g);
            var Ea = !Eh(Ch, T(a)),
                Dl = d || Rh(l, T(a)),
                sd = (d = Sh(l, T(a))) && d.a;
            K && sd && sd.providerId !== K && (sd = null);
            f.render(b);
            Z(a, f);
            W(a, f.J(function() {
                var Aa = G(null);
                Aa = r && Ea || Ea && p ? ef(Error("anonymous-user-not-found")) : Dn(a, c).then(function(Kg) {
                    if (K && !sd) throw Error("pending-credential-not-found");
                    return Kg
                });
                var td = null;
                return Aa.then(function(Kg) {
                    td = Kg;
                    return e ? null : X(a).checkActionCode(h)
                }).then(function() {
                    return td
                })
            }, [], function(Aa) {
                Dl ? En(a, f, Dl, c, sd, Aa) : p ? (f.o(), L("differentDeviceError", a, b)) :
                    (f.o(), L("emailLinkConfirmation", a, b, c, Fn))
            }, function(Aa) {
                var td = void 0;
                if (!Aa || !Aa.name || "cancel" != Aa.name) switch (f.o(), Aa && Aa.message) {
                    case "anonymous-user-not-found":
                        L("differentDeviceError", a, b);
                        break;
                    case "anonymous-user-mismatch":
                        L("anonymousUserMismatch", a, b);
                        break;
                    case "pending-credential-not-found":
                        L("emailLinkNewDeviceLinking", a, b, c, Gn);
                        break;
                    default:
                        Aa && (td = U(Aa)), V(a, b, void 0, td)
                }
            }))
        }

        function Fn(a, b, c, d) {
            Bn(a, b, d, c, !0)
        }

        function Gn(a, b, c) {
            Bn(a, b, c)
        }

        function En(a, b, c, d, e, f) {
            var g = Q(b);
            b.Z("mdl-spinner mdl-spinner--single-color mdl-js-spinner is-active firebaseui-progress-dialog-loading-icon",
                C("Signing in...").toString());
            var h = null;
            e = (f ? Hn(a, f, c, d, e) : In(a, c, d, e)).then(function(l) {
                Fh(Dh, T(a));
                Fh(Ch, T(a));
                b.h();
                b.Z("firebaseui-icon-done", C("Signed in!").toString());
                h = setTimeout(function() {
                    b.h();
                    Cm(a, b, l, !0)
                }, 1E3);
                W(a, function() {
                    b && (b.h(), b.o());
                    clearTimeout(h)
                })
            }, function(l) {
                b.h();
                b.o();
                if (!l.name || "cancel" != l.name) {
                    var p = U(l);
                    "auth/email-already-in-use" == l.code || "auth/credential-already-in-use" == l.code ? (Fh(Dh, T(a)), Fh(Ch, T(a))) : "auth/invalid-email" == l.code ? (p = C("The email provided does not match the current sign-in session.").toString(),
                        L("emailLinkConfirmation", a, g, d, Fn, null, p)) : V(a, g, c, p)
                }
            });
            W(a, e)
        }
        J.emailLinkSignInCallback = Bn;

        function Jn(a, b, c, d, e, f) {
            P.call(this, sl, {
                email: a,
                ga: b
            }, f, "emailLinkSignInLinking", {
                G: d,
                F: e
            });
            this.i = c
        }
        m(Jn, P);
        Jn.prototype.v = function() {
            this.u(this.i);
            this.l().focus();
            P.prototype.v.call(this)
        };
        Jn.prototype.m = function() {
            this.i = null;
            P.prototype.m.call(this)
        };
        u(Jn.prototype, {
            l: Rl,
            u: Tl
        });

        function Kn(a, b, c, d) {
            var e = Q(b);
            Rm(a, b, c, function() {
                V(a, e, c)
            }, function(f) {
                if (!f.name || "cancel" != f.name) {
                    var g = U(f);
                    f && "auth/network-request-failed" ==
                        f.code ? b.a(g) : (b.o(), V(a, e, c, g))
                }
            }, d)
        }
        J.emailLinkSignInLinking = function(a, b, c) {
            var d = Mh(T(a));
            Nh(T(a));
            if (d) {
                var e = d.a.providerId,
                    f = new Jn(c, zi(S(a), e), function() {
                        Kn(a, f, c, d)
                    }, I(S(a)), Mi(S(a)));
                f.render(b);
                Z(a, f)
            } else V(a, b)
        };

        function Ln(a, b, c, d, e, f) {
            P.call(this, ml, {
                email: a
            }, f, "emailLinkSignInSent", {
                G: d,
                F: e
            });
            this.u = b;
            this.i = c
        }
        m(Ln, P);
        Ln.prototype.v = function() {
            var a = this;
            O(this, this.l(), function() {
                a.i()
            });
            O(this, M(this, "firebaseui-id-trouble-getting-email-link"), function() {
                a.u()
            });
            this.l().focus();
            P.prototype.v.call(this)
        };
        Ln.prototype.m = function() {
            this.i = this.u = null;
            P.prototype.m.call(this)
        };
        u(Ln.prototype, {
            l: Sl
        });
        J.emailLinkSignInSent = function(a, b, c, d, e) {
            var f = new Ln(c, function() {
                f.o();
                L("emailNotReceived", a, b, c, d, e)
            }, function() {
                f.o();
                d()
            }, I(S(a)), Mi(S(a)));
            f.render(b);
            Z(a, f)
        };

        function Mn(a, b, c, d, e, f, g) {
            P.call(this, Kl, {
                ic: a,
                Pb: b
            }, g, "emailMismatch", {
                G: e,
                F: f
            });
            this.l = c;
            this.i = d
        }
        m(Mn, P);
        Mn.prototype.v = function() {
            this.A(this.l, this.i);
            this.u().focus();
            P.prototype.v.call(this)
        };
        Mn.prototype.m =
            function() {
                this.i = null;
                P.prototype.m.call(this)
            };
        u(Mn.prototype, {
            u: Rl,
            C: Sl,
            A: Tl
        });
        J.emailMismatch = function(a, b, c) {
            var d = Mh(T(a));
            if (d) {
                var e = new Mn(c.user.email, d.g, function() {
                    var f = e;
                    Nh(T(a));
                    Cm(a, f, c)
                }, function() {
                    var f = c.credential.providerId,
                        g = Q(e);
                    e.o();
                    d.a ? L("federatedLinking", a, g, d.g, f) : L("federatedSignIn", a, g, d.g, f)
                }, I(S(a)), Mi(S(a)));
                e.render(b);
                Z(a, e)
            } else V(a, b)
        };

        function Nn(a, b, c, d, e) {
            P.call(this, nl, void 0, e, "emailNotReceived", {
                G: c,
                F: d
            });
            this.l = a;
            this.i = b
        }
        m(Nn, P);
        Nn.prototype.v = function() {
            var a =
                this;
            O(this, this.u(), function() {
                a.i()
            });
            O(this, this.Ba(), function() {
                a.l()
            });
            this.u().focus();
            P.prototype.v.call(this)
        };
        Nn.prototype.Ba = function() {
            return M(this, "firebaseui-id-resend-email-link")
        };
        Nn.prototype.m = function() {
            this.i = this.l = null;
            P.prototype.m.call(this)
        };
        u(Nn.prototype, {
            u: Sl
        });
        J.emailNotReceived = function(a, b, c, d, e) {
            var f = new Nn(function() {
                Rm(a, f, c, d, function(g) {
                    g = U(g);
                    f.a(g)
                }, e)
            }, function() {
                f.o();
                V(a, b, c)
            }, I(S(a)), Mi(S(a)));
            f.render(b);
            Z(a, f)
        };

        function On(a, b, c, d, e, f) {
            P.call(this, ul, {
                email: a,
                ga: b
            }, f, "federatedLinking", {
                G: d,
                F: e
            });
            this.i = c
        }
        m(On, P);
        On.prototype.v = function() {
            this.u(this.i);
            this.l().focus();
            P.prototype.v.call(this)
        };
        On.prototype.m = function() {
            this.i = null;
            P.prototype.m.call(this)
        };
        u(On.prototype, {
            l: Rl,
            u: Tl
        });
        J.federatedLinking = function(a, b, c, d, e) {
            var f = Mh(T(a));
            if (f && f.a) {
                var g = new On(c, zi(S(a), d), function() {
                    Im(a, g, d, c)
                }, I(S(a)), Mi(S(a)));
                g.render(b);
                Z(a, g);
                e && g.a(e)
            } else V(a, b)
        };
        J.federatedRedirect = function(a, b, c) {
            var d = new An;
            d.render(b);
            Z(a, d);
            b = yi(S(a))[0];
            Im(a, d, b, c)
        };
        J.federatedSignIn = function(a, b, c, d, e) {
            var f = new On(c, zi(S(a), d), function() {
                Im(a, f, d, c)
            }, I(S(a)), Mi(S(a)));
            f.render(b);
            Z(a, f);
            e && f.a(e)
        };

        function Pn(a, b, c, d) {
            var e = b.u();
            e ? W(a, b.J(t(a.Wb, a), [c, e], function(f) {
                f = f.user.linkWithCredential(d).then(function(g) {
                    return Cm(a, b, {
                        user: g.user,
                        credential: d,
                        operationType: g.operationType,
                        additionalUserInfo: g.additionalUserInfo
                    })
                });
                W(a, f);
                return f
            }, function(f) {
                if (!f.name || "cancel" != f.name) switch (f.code) {
                    case "auth/wrong-password":
                        N(b.i(), !1);
                        xk(b.C(), U(f));
                        break;
                    case "auth/too-many-requests":
                        b.a(U(f));
                        break;
                    default:
                        rg("signInWithEmailAndPassword: " + f.message, void 0), b.a(U(f))
                }
            })) : b.i().focus()
        }
        J.passwordLinking = function(a, b, c) {
            var d = Mh(T(a));
            Nh(T(a));
            var e = d && d.a;
            if (e) {
                var f = new Yl(c, function() {
                    Pn(a, f, c, e)
                }, function() {
                    f.o();
                    L("passwordRecovery", a, b, c)
                }, I(S(a)), Mi(S(a)));
                f.render(b);
                Z(a, f)
            } else V(a, b)
        };

        function Qn(a, b, c, d, e, f) {
            P.call(this, hl, {
                email: c,
                Ta: !!b
            }, f, "passwordRecovery", {
                G: d,
                F: e
            });
            this.l = a;
            this.u = b
        }
        m(Qn, P);
        Qn.prototype.v = function() {
            this.C();
            this.I(this.l,
                this.u);
            Ej(this.i()) || this.i().focus();
            dl(this, this.i(), this.l);
            P.prototype.v.call(this)
        };
        Qn.prototype.m = function() {
            this.u = this.l = null;
            P.prototype.m.call(this)
        };
        u(Qn.prototype, {
            i: $l,
            A: am,
            C: bm,
            N: cm,
            j: dm,
            U: Rl,
            R: Sl,
            I: Tl
        });

        function Rn(a, b) {
            var c = b.j();
            if (c) {
                var d = Q(b);
                W(a, b.J(t(X(a).sendPasswordResetEmail, X(a)), [c], function() {
                    b.o();
                    var e = new fm(c, function() {
                        e.o();
                        V(a, d)
                    }, I(S(a)), Mi(S(a)));
                    e.render(d);
                    Z(a, e)
                }, function(e) {
                    N(b.i(), !1);
                    xk(b.A(), U(e))
                }))
            } else b.i().focus()
        }
        J.passwordRecovery = function(a, b,
            c, d, e) {
            var f = new Qn(function() {
                Rn(a, f)
            }, d ? void 0 : function() {
                f.o();
                V(a, b)
            }, c, I(S(a)), Mi(S(a)));
            f.render(b);
            Z(a, f);
            e && f.a(e)
        };
        J.passwordSignIn = function(a, b, c, d) {
            var e = new em(function() {
                Nm(a, e)
            }, function() {
                var f = e.N();
                e.o();
                L("passwordRecovery", a, b, f)
            }, c, I(S(a)), Mi(S(a)), d);
            e.render(b);
            Z(a, e)
        };

        function Sn() {
            return M(this, "firebaseui-id-name")
        }

        function Tn() {
            return M(this, "firebaseui-id-name-error")
        }

        function Un(a, b, c, d, e, f, g, h, l) {
            P.call(this, gl, {
                email: d,
                Sb: a,
                name: e,
                Ta: !!c,
                ia: !!h
            }, l, "passwordSignUp", {
                G: f,
                F: g
            });
            this.A = b;
            this.I = c;
            this.C = a
        }
        m(Un, P);
        Un.prototype.v = function() {
            this.ea();
            this.C && this.Ia();
            this.ua();
            this.pa(this.A, this.I);
            this.C ? (cl(this, this.i(), this.u()), cl(this, this.u(), this.l())) : cl(this, this.i(), this.l());
            this.A && dl(this, this.l(), this.A);
            Ej(this.i()) ? this.C && !Ej(this.u()) ? this.u().focus() : this.l().focus() : this.i().focus();
            P.prototype.v.call(this)
        };
        Un.prototype.m = function() {
            this.I = this.A = null;
            P.prototype.m.call(this)
        };
        u(Un.prototype, {
            i: $l,
            U: am,
            ea: bm,
            jb: cm,
            j: dm,
            u: Sn,
            Ac: Tn,
            Ia: function() {
                var a =
                    Sn.call(this),
                    b = Tn.call(this);
                sk(this, a, function() {
                    yk(b) && (N(a, !0), wk(b))
                })
            },
            N: function() {
                var a = Sn.call(this);
                var b = Tn.call(this);
                var c = Ej(a);
                c = !/^[\s\xa0]*$/.test(null == c ? "" : String(c));
                N(a, c);
                c ? (wk(b), b = !0) : (xk(b, C("Enter your account name").toString()), b = !1);
                return b ? Wa(Ej(a)) : null
            },
            l: ln,
            ba: on,
            lb: mn,
            ua: pn,
            R: qn,
            Mb: Rl,
            Lb: Sl,
            pa: Tl
        });

        function Vn(a, b) {
            var c = Ni(S(a)),
                d = b.j(),
                e = null;
            c && (e = b.N());
            var f = b.R();
            if (d) {
                if (c)
                    if (e) e = eb(e);
                    else {
                        b.u().focus();
                        return
                    } if (f) {
                    var g = firebase.auth.EmailAuthProvider.credential(d,
                        f);
                    W(a, b.J(t(a.Xb, a), [d, f], function(h) {
                        var l = {
                            user: h.user,
                            credential: g,
                            operationType: h.operationType,
                            additionalUserInfo: h.additionalUserInfo
                        };
                        return c ? (h = h.user.updateProfile({
                            displayName: e
                        }).then(function() {
                            return Cm(a, b, l)
                        }), W(a, h), h) : Cm(a, b, l)
                    }, function(h) {
                        if (!h.name || "cancel" != h.name) {
                            var l = U(h);
                            switch (h.code) {
                                case "auth/email-already-in-use":
                                    return Wn(a, b, d, h);
                                case "auth/too-many-requests":
                                    l = C("Too many account requests are coming from your IP address. Try again in a few minutes.").toString();
                                case "auth/operation-not-allowed":
                                case "auth/weak-password":
                                    N(b.l(), !1);
                                    xk(b.ba(), l);
                                    break;
                                default:
                                    h = "setAccountInfo: " + eh(h), rg(h, void 0), b.a(l)
                            }
                        }
                    }))
                } else b.l().focus()
            } else b.i().focus()
        }

        function Wn(a, b, c, d) {
            function e() {
                var g = U(d);
                N(b.i(), !1);
                xk(b.U(), g);
                b.i().focus()
            }
            var f = X(a).fetchSignInMethodsForEmail(c).then(function(g) {
                g.length ? e() : (g = Q(b), b.o(), L("passwordRecovery", a, g, c, !1, Md().toString()))
            }, function() {
                e()
            });
            W(a, f);
            return f
        }
        J.passwordSignUp = function(a, b, c, d, e, f) {
            function g() {
                h.o();
                V(a,
                    b)
            }
            var h = new Un(Ni(S(a)), function() {
                Vn(a, h)
            }, e ? void 0 : g, c, d, I(S(a)), Mi(S(a)), f);
            h.render(b);
            Z(a, h)
        };

        function Xn() {
            return M(this, "firebaseui-id-phone-confirmation-code")
        }

        function Yn() {
            return M(this, "firebaseui-id-phone-confirmation-code-error")
        }

        function Zn() {
            return M(this, "firebaseui-id-resend-countdown")
        }

        function $n(a, b, c, d, e, f, g, h, l) {
            P.call(this, Nl, {
                phoneNumber: e
            }, l, "phoneSignInFinish", {
                G: g,
                F: h
            });
            this.jb = f;
            this.i = new Qj(1E3);
            this.C = f;
            this.R = a;
            this.l = b;
            this.I = c;
            this.N = d
        }
        m($n, P);
        $n.prototype.v = function() {
            var a =
                this;
            this.U(this.jb);
            me(this.i, "tick", this.A, !1, this);
            this.i.start();
            O(this, M(this, "firebaseui-id-change-phone-number-link"), function() {
                a.R()
            });
            O(this, this.Ba(), function() {
                a.N()
            });
            this.Ia(this.l);
            this.ea(this.l, this.I);
            this.u().focus();
            P.prototype.v.call(this)
        };
        $n.prototype.m = function() {
            this.N = this.I = this.l = this.R = null;
            Rj(this.i);
            ue(this.i, "tick", this.A);
            this.i = null;
            P.prototype.m.call(this)
        };
        $n.prototype.A = function() {
            --this.C;
            0 < this.C ? this.U(this.C) : (Rj(this.i), ue(this.i, "tick", this.A), this.ua(),
                this.lb())
        };
        u($n.prototype, {
            u: Xn,
            pa: Yn,
            Ia: function(a) {
                var b = Xn.call(this),
                    c = Yn.call(this);
                sk(this, b, function() {
                    yk(c) && (N(b, !0), wk(c))
                });
                a && tk(this, b, function() {
                    a()
                })
            },
            ba: function() {
                var a = Wa(Ej(Xn.call(this)) || "");
                return /^\d{6}$/.test(a) ? a : null
            },
            Eb: Zn,
            U: function(a) {
                bd(Zn.call(this), C("Resend code in " + ((9 < a ? "0:" : "0:0") + a)).toString())
            },
            ua: function() {
                wk(this.Eb())
            },
            Ba: function() {
                return M(this, "firebaseui-id-resend-link")
            },
            lb: function() {
                xk(this.Ba())
            },
            Mb: Rl,
            Lb: Sl,
            ea: Tl
        });

        function ao(a, b, c, d) {
            function e(g) {
                b.u().focus();
                N(b.u(), !1);
                xk(b.pa(), g)
            }
            var f = b.ba();
            f ? (b.Z("mdl-spinner mdl-spinner--single-color mdl-js-spinner is-active firebaseui-progress-dialog-loading-icon", C("Verifying...").toString()), W(a, b.J(t(d.confirm, d), [f], function(g) {
                b.h();
                b.Z("firebaseui-icon-done", C("Verified!").toString());
                var h = setTimeout(function() {
                    b.h();
                    b.o();
                    var l = {
                        user: bo(a).currentUser,
                        credential: null,
                        operationType: g.operationType,
                        additionalUserInfo: g.additionalUserInfo
                    };
                    Cm(a, b, l, !0)
                }, 1E3);
                W(a, function() {
                    b && b.h();
                    clearTimeout(h)
                })
            }, function(g) {
                if (g.name &&
                    "cancel" == g.name) b.h();
                else {
                    var h = U(g);
                    switch (g.code) {
                        case "auth/credential-already-in-use":
                            b.h();
                            break;
                        case "auth/code-expired":
                            g = Q(b);
                            b.h();
                            b.o();
                            L("phoneSignInStart", a, g, c, h);
                            break;
                        case "auth/missing-verification-code":
                        case "auth/invalid-verification-code":
                            b.h();
                            e(h);
                            break;
                        default:
                            b.h(), b.a(h)
                    }
                }
            }))) : e(C("Wrong code. Try again.").toString())
        }
        J.phoneSignInFinish = function(a, b, c, d, e, f) {
            var g = new $n(function() {
                g.o();
                L("phoneSignInStart", a, b, c)
            }, function() {
                ao(a, g, c, e)
            }, function() {
                g.o();
                V(a, b)
            }, function() {
                g.o();
                L("phoneSignInStart", a, b, c)
            }, ki(c), d, I(S(a)), Mi(S(a)));
            g.render(b);
            Z(a, g);
            f && g.a(f)
        };
        var co = !z && !(y("Safari") && !($b() || y("Coast") || y("Opera") || y("Edge") || y("Firefox") || y("FxiOS") || y("Silk") || y("Android")));

        function eo(a, b) {
            if (/-[a-z]/.test(b)) return null;
            if (co && a.dataset) {
                if (!(!y("Android") || $b() || y("Firefox") || y("FxiOS") || y("Opera") || y("Silk") || b in a.dataset)) return null;
                a = a.dataset[b];
                return void 0 === a ? null : a
            }
            return a.getAttribute("data-" + String(b).replace(/([A-Z])/g, "-$1").toLowerCase())
        }

        function fo(a,
            b, c) {
            var d = this;
            a = jd(Nk, {
                items: a
            }, null, this.s);
            Uk.call(this, a, !0, !0);
            c && (c = go(a, c)) && (c.focus(), kk(c, a));
            O(this, a, function(e) {
                if (e = (e = cd(e.target, "firebaseui-id-list-box-dialog-button")) && eo(e, "listboxid")) Vk.call(d), b(e)
            })
        }

        function go(a, b) {
            a = (a || document).getElementsByTagName("BUTTON");
            for (var c = 0; c < a.length; c++)
                if (eo(a[c], "listboxid") === b) return a[c];
            return null
        }

        function ho() {
            return M(this, "firebaseui-id-phone-number")
        }

        function io() {
            return M(this, "firebaseui-id-country-selector")
        }

        function jo() {
            return M(this,
                "firebaseui-id-phone-number-error")
        }

        function ko(a, b) {
            var c = a.a,
                d = lo("1-US-0", c),
                e = null;
            b && lo(b, c) ? e = b : d ? e = "1-US-0" : e = 0 < c.length ? c[0].c : null;
            if (!e) throw Error("No available default country");
            mo.call(this, e, a)
        }

        function lo(a, b) {
            a = ci(a);
            return !(!a || !Na(b, a))
        }

        function no(a) {
            return Ka(a, function(b) {
                return {
                    id: b.c,
                    La: "firebaseui-flag " + oo(b),
                    label: b.name + " " + ("\u200e+" + b.b)
                }
            })
        }

        function oo(a) {
            return "firebaseui-flag-" + a.f
        }

        function po(a) {
            var b = this;
            fo.call(this, no(a.a), function(c) {
                    mo.call(b, c, a, !0);
                    b.P().focus()
                },
                this.Aa)
        }

        function mo(a, b, c) {
            var d = ci(a);
            d && (c && (c = Wa(Ej(ho.call(this)) || ""), b = bi(b, c), b.length && b[0].b != d.b && (c = "+" + d.b + c.substr(b[0].b.length + 1), Fj(ho.call(this), c))), b = ci(this.Aa), this.Aa = a, a = M(this, "firebaseui-id-country-selector-flag"), b && Dj(a, oo(b)), Cj(a, oo(d)), bd(M(this, "firebaseui-id-country-selector-code"), "\u200e+" + d.b))
        }

        function qo(a, b, c, d, e, f, g, h, l, p) {
            P.call(this, Ml, {
                Fb: b,
                za: l || null,
                Va: !!c,
                ia: !!f
            }, p, "phoneSignInStart", {
                G: d,
                F: e
            });
            this.I = h || null;
            this.N = b;
            this.l = a;
            this.A = c || null;
            this.pa = g ||
                null
        }
        m(qo, P);
        qo.prototype.v = function() {
            this.ea(this.pa, this.I);
            this.R(this.l, this.A || void 0);
            this.N || cl(this, this.P(), this.i());
            dl(this, this.i(), this.l);
            this.P().focus();
            xn(this.P(), (this.P().value || "").length);
            P.prototype.v.call(this)
        };
        qo.prototype.m = function() {
            this.A = this.l = null;
            P.prototype.m.call(this)
        };
        u(qo.prototype, {
            Cb: Wk,
            P: ho,
            C: jo,
            ea: function(a, b, c) {
                var d = this,
                    e = ho.call(this),
                    f = io.call(this),
                    g = jo.call(this),
                    h = a || hi,
                    l = h.a;
                if (0 == l.length) throw Error("No available countries provided.");
                ko.call(d,
                    h, b);
                O(this, f, function() {
                    po.call(d, h)
                });
                sk(this, e, function() {
                    yk(g) && (N(e, !0), wk(g));
                    var p = Wa(Ej(e) || ""),
                        r = ci(this.Aa),
                        K = bi(h, p);
                    p = lo("1-US-0", l);
                    K.length && K[0].b != r.b && (r = K[0], mo.call(d, "1" == r.b && p ? "1-US-0" : r.c, h))
                });
                c && tk(this, e, function() {
                    c()
                })
            },
            U: function(a) {
                var b = Wa(Ej(ho.call(this)) || "");
                a = a || hi;
                var c = a.a,
                    d = bi(hi, b);
                if (d.length && !Na(c, d[0])) throw Fj(ho.call(this)), ho.call(this).focus(), xk(jo.call(this), C("The country code provided is not supported.").toString()), Error("The country code provided is not supported.");
                c = ci(this.Aa);
                d.length && d[0].b != c.b && mo.call(this, d[0].c, a);
                d.length && (b = b.substr(d[0].b.length + 1));
                return b ? new ii(this.Aa, b) : null
            },
            Ia: io,
            ba: function() {
                return M(this, "firebaseui-recaptcha-container")
            },
            u: function() {
                return M(this, "firebaseui-id-recaptcha-error")
            },
            i: Rl,
            ua: Sl,
            R: Tl
        });

        function ro(a, b, c, d) {
            try {
                var e = b.U(dj)
            } catch (f) {
                return
            }
            e ? bj ? (b.Z("mdl-spinner mdl-spinner--single-color mdl-js-spinner is-active firebaseui-progress-dialog-loading-icon", C("Verifying...").toString()), W(a, b.J(t(a.bc, a), [ki(e),
                c
            ], function(f) {
                var g = Q(b);
                b.Z("firebaseui-icon-done", C("Code sent!").toString());
                var h = setTimeout(function() {
                    b.h();
                    b.o();
                    L("phoneSignInFinish", a, g, e, 15, f)
                }, 1E3);
                W(a, function() {
                    b && b.h();
                    clearTimeout(h)
                })
            }, function(f) {
                b.h();
                if (!f.name || "cancel" != f.name) {
                    grecaptcha.reset(ej);
                    bj = null;
                    var g = f && f.message || "";
                    if (f.code) switch (f.code) {
                        case "auth/too-many-requests":
                            g = C("This phone number has been used too many times").toString();
                            break;
                        case "auth/invalid-phone-number":
                        case "auth/missing-phone-number":
                            b.P().focus();
                            xk(b.C(), Jd().toString());
                            return;
                        default:
                            g = U(f)
                    }
                    b.a(g)
                }
            }))) : cj ? xk(b.u(), C("Solve the reCAPTCHA").toString()) : !cj && d && b.i().click() : (b.P().focus(), xk(b.C(), Jd().toString()))
        }
        J.phoneSignInStart = function(a, b, c, d) {
            var e = Fi(S(a)) || {};
            bj = null;
            cj = !(e && "invisible" === e.size);
            var f = Om(a),
                g = Ki(S(a)),
                h = f ? Ji(S(a)) : null;
            g = c && c.a || g && g.c || null;
            c = c && c.za || h;
            (h = Li(S(a))) && gi(h);
            dj = h ? new ai(Li(S(a))) : hi;
            var l = new qo(function(r) {
                    ro(a, l, p, !(!r || !r.keyCode))
                }, cj, f ? null : function() {
                    p.clear();
                    l.o();
                    V(a, b)
                }, I(S(a)), Mi(S(a)),
                f, dj, g, c);
            l.render(b);
            Z(a, l);
            d && l.a(d);
            e.callback = function(r) {
                l.u() && wk(l.u());
                bj = r;
                cj || ro(a, l, p)
            };
            e["expired-callback"] = function() {
                bj = null
            };
            var p = new firebase.auth.RecaptchaVerifier(cj ? l.ba() : l.i(), e, bo(a).app);
            W(a, l.J(t(p.render, p), [], function(r) {
                ej = r
            }, function(r) {
                r.name && "cancel" == r.name || (r = U(r), l.o(), V(a, b, void 0, r))
            }))
        };
        J.prefilledEmailSignIn = function(a, b, c) {
            var d = new An;
            d.render(b);
            Z(a, d);
            W(a, d.J(t(X(a).fetchSignInMethodsForEmail, X(a)), [c], function(e) {
                d.o();
                var f = !(!ym(a) || !Ym(a));
                zm(a, b, e,
                    c, void 0, void 0, f)
            }, function(e) {
                e = U(e);
                d.o();
                L("signIn", a, b, c, e)
            }))
        };

        function so(a, b, c, d, e) {
            P.call(this, Ll, {
                Rb: b
            }, e, "providerSignIn", {
                G: c,
                F: d
            });
            this.i = a
        }
        m(so, P);
        so.prototype.v = function() {
            this.l(this.i);
            P.prototype.v.call(this)
        };
        so.prototype.m = function() {
            this.i = null;
            P.prototype.m.call(this)
        };
        u(so.prototype, {
            l: function(a) {
                function b(g) {
                    a(g)
                }
                for (var c = this.g ? Vc("firebaseui-id-idp-button", this.g || this.s.a) : [], d = 0; d < c.length; d++) {
                    var e = c[d],
                        f = eo(e, "providerId");
                    O(this, e, ya(b, f))
                }
            }
        });
        J.providerSignIn = function(a,
            b, c, d) {
            var e = new so(function(f) {
                f == firebase.auth.EmailAuthProvider.PROVIDER_ID ? (e.o(), Pm(a, b, d)) : f == firebase.auth.PhoneAuthProvider.PROVIDER_ID ? (e.o(), L("phoneSignInStart", a, b)) : "anonymous" == f ? Lm(a, e) : Im(a, e, f, d);
                Y(a);
                a.l.cancel()
            }, Ai(S(a)), I(S(a)), Mi(S(a)));
            e.render(b);
            Z(a, e);
            c && e.a(c);
            to(a)
        };
        J.sendEmailLinkForSignIn = function(a, b, c, d) {
            var e = new an;
            e.render(b);
            Z(a, e);
            Rm(a, e, c, d, function(f) {
                e.o();
                f = U(f);
                L("signIn", a, b, c, f)
            })
        };

        function uo(a, b, c, d, e, f, g) {
            P.call(this, el, {
                email: c,
                Va: !!b,
                ia: !!f
            }, g, "signIn", {
                G: d,
                F: e
            });
            this.i = a;
            this.u = b
        }
        m(uo, P);
        uo.prototype.v = function() {
            this.A(this.i);
            this.C(this.i, this.u || void 0);
            this.l().focus();
            xn(this.l(), (this.l().value || "").length);
            P.prototype.v.call(this)
        };
        uo.prototype.m = function() {
            this.u = this.i = null;
            P.prototype.m.call(this)
        };
        u(uo.prototype, {
            l: $l,
            N: am,
            A: bm,
            I: cm,
            j: dm,
            U: Rl,
            R: Sl,
            C: Tl
        });
        J.signIn = function(a, b, c, d) {
            var e = ym(a),
                f = e && Di(S(a)) != pi,
                g = new uo(function() {
                    var h = g,
                        l = h.j() || "";
                    l && Qm(a, h, l)
                }, f ? null : function() {
                    g.o();
                    V(a, b, c)
                }, c, I(S(a)), Mi(S(a)), e);
            g.render(b);
            Z(a,
                g);
            d && g.a(d)
        };

        function vo(a, b, c, d, e, f) {
            P.call(this, vl, {
                email: a
            }, f, "unsupportedProvider", {
                G: d,
                F: e
            });
            this.l = b;
            this.i = c
        }
        m(vo, P);
        vo.prototype.v = function() {
            this.A(this.l, this.i);
            this.u().focus();
            P.prototype.v.call(this)
        };
        vo.prototype.m = function() {
            this.i = this.l = null;
            P.prototype.m.call(this)
        };
        u(vo.prototype, {
            u: Rl,
            C: Sl,
            A: Tl
        });
        J.unsupportedProvider = function(a, b, c) {
            var d = new vo(c, function() {
                d.o();
                L("passwordRecovery", a, b, c)
            }, function() {
                d.o();
                V(a, b, c)
            }, I(S(a)), Mi(S(a)));
            d.render(b);
            Z(a, d)
        };

        function wo(a, b) {
            this.Z = !1;
            var c = xo(b);
            if (yo[c]) throw Error('An AuthUI instance already exists for the key "' + c + '"');
            yo[c] = this;
            this.g = a;
            this.u = null;
            this.X = !1;
            zo(this.g);
            this.a = firebase.initializeApp({
                apiKey: a.app.options.apiKey,
                authDomain: a.app.options.authDomain
            }, a.app.name + "-firebaseui-temp").auth();
            zo(this.a);
            this.a.setPersistence && this.a.setPersistence(firebase.auth.Auth.Persistence.SESSION);
            this.oa = b;
            this.ca = new oi;
            this.h = this.T = this.i = this.K = this.P = null;
            this.s = [];
            this.Y = !1;
            this.l = Rf.Xa();
            this.j = this.D = null;
            this.da =
                this.B = !1
        }

        function zo(a) {
            a && a.INTERNAL && a.INTERNAL.logFramework && a.INTERNAL.logFramework("FirebaseUI-web")
        }
        var yo = {};

        function xo(a) {
            return a || "[DEFAULT]"
        }

        function Jm(a) {
            Y(a);
            a.i || (a.i = Ao(a, function(b) {
                return b && !Mh(T(a)) ? G(bo(a).getRedirectResult().then(function(c) {
                    return c
                }, function(c) {
                    if (c && "auth/email-already-in-use" == c.code && c.email && c.credential) throw c;
                    return Bo(a, c)
                })) : G(X(a).getRedirectResult().then(function(c) {
                    return ui(S(a)) && !c.user && a.j && !a.j.isAnonymous ? bo(a).getRedirectResult() : c
                }))
            }));
            return a.i
        }

        function Z(a, b) {
            Y(a);
            a.h = b
        }
        var Co = null;

        function Sm() {
            return Co
        }

        function X(a) {
            Y(a);
            return a.a
        }

        function bo(a) {
            Y(a);
            return a.g
        }

        function T(a) {
            Y(a);
            return a.oa
        }

        function Ym(a) {
            Y(a);
            return a.P ? a.P.emailHint : void 0
        }
        k = wo.prototype;
        k.nb = function() {
            Y(this);
            return !!Ph(T(this)) || Do(vf())
        };

        function Do(a) {
            a = new Sb(a);
            return "signIn" === (a.a.a.get(x.vb) || null) && !!a.a.a.get(x.$a)
        }
        k.start = function(a, b) {
            Eo(this, a, b)
        };

        function Eo(a, b, c, d) {
            Y(a);
            "undefined" !== typeof a.g.languageCode && (a.u = a.g.languageCode);
            var e =
                "en".replace(/_/g, "-");
            a.g.languageCode = e;
            a.a.languageCode = e;
            a.X = !0;
            "undefined" !== typeof a.g.tenantId && (a.a.tenantId = a.g.tenantId);
            a.ib(c);
            a.P = d || null;
            var f = n.document;
            a.D ? a.D.then(function() {
                "complete" == f.readyState ? Fo(a, b) : ne(window, "load", function() {
                    Fo(a, b)
                })
            }) : "complete" == f.readyState ? Fo(a, b) : ne(window, "load", function() {
                Fo(a, b)
            })
        }

        function Fo(a, b) {
            var c = uf(b, "Could not find the FirebaseUI widget element on the page.");
            c.setAttribute("lang", "en".replace(/_/g, "-"));
            if (Co) {
                var d = Co;
                Y(d);
                Mh(T(d)) &&
                    wg("UI Widget is already rendered on the page and is pending some user interaction. Only one widget instance can be rendered per page. The previous instance has been automatically reset.");
                Co.reset()
            }
            Co = a;
            a.T = c;
            Go(a, c);
            nh(new oh) && nh(new ph) ? Xm(a, b) : (b = uf(b, "Could not find the FirebaseUI widget element on the page."), c = new qm(C("The browser you are using does not support Web Storage. Please try again in a different browser.").toString()), c.render(b), Z(a, c));
            b = a.h && "blank" == a.h.Ea && Ri(S(a));
            Ph(T(a)) &&
                !b && (b = Ph(T(a)), Cn(a, b.a), Fh(yh, T(a)))
        }

        function Ao(a, b) {
            if (a.B) return b(Ho(a));
            W(a, function() {
                a.B = !1
            });
            if (ui(S(a))) {
                var c = new F(function(d) {
                    W(a, a.g.onAuthStateChanged(function(e) {
                        a.j = e;
                        a.B || (a.B = !0, d(b(Ho(a))))
                    }))
                });
                W(a, c);
                return c
            }
            a.B = !0;
            return b(null)
        }

        function Ho(a) {
            Y(a);
            return ui(S(a)) && a.j && a.j.isAnonymous ? a.j : null
        }

        function W(a, b) {
            Y(a);
            if (b) {
                a.s.push(b);
                var c = function() {
                    Ra(a.s, function(d) {
                        return d == b
                    })
                };
                "function" != typeof b && b.then(c, c)
            }
        }
        k.Db = function() {
            Y(this);
            this.Y = !0
        };

        function Io(a) {
            Y(a);
            var b;
            (b = a.Y) || (a = S(a), a = Ii(a, firebase.auth.GoogleAuthProvider.PROVIDER_ID), b = !(!a || "select_account" !== a.prompt));
            return b
        }

        function Dm(a) {
            "undefined" !== typeof a.g.languageCode && a.X && (a.X = !1, a.g.languageCode = a.u)
        }

        function Cn(a, b) {
            a.g.tenantId = b;
            a.a.tenantId = b
        }
        k.reset = function() {
            Y(this);
            var a = this;
            this.T && this.T.removeAttribute("lang");
            this.K && Fe(this.K);
            Dm(this);
            this.P = null;
            Zm();
            Fh(yh, T(this));
            Y(this);
            this.l.cancel();
            this.i = G({
                user: null,
                credential: null
            });
            Co == this && (Co = null);
            this.T = null;
            for (var b = 0; b <
                this.s.length; b++)
                if ("function" == typeof this.s[b]) this.s[b]();
                else this.s[b].cancel && this.s[b].cancel();
            this.s = [];
            Nh(T(this));
            this.h && (this.h.o(), this.h = null);
            this.M = null;
            this.a && (this.D = hn(this).then(function() {
                a.D = null
            }, function() {
                a.D = null
            }))
        };

        function Go(a, b) {
            a.M = null;
            a.K = new Ge(b);
            a.K.register();
            me(a.K, "pageEnter", function(c) {
                c = c && c.pageId;
                if (a.M != c) {
                    var d = S(a);
                    (d = Wi(d).uiChanged || null) && d(a.M, c);
                    a.M = c
                }
            })
        }
        k.ib = function(a) {
            Y(this);
            var b = this.ca,
                c;
            for (c in a) try {
                Vh(b.a, c, a[c])
            } catch (d) {
                rg('Invalid config: "' +
                    c + '"', void 0)
            }
            ic && Vh(b.a, "popupMode", !1);
            Li(b);
            !this.da && Xi(S(this)) && (wg("signInSuccess callback is deprecated. Please use signInSuccessWithAuthResult callback instead."), this.da = !0)
        };

        function S(a) {
            Y(a);
            return a.ca
        }
        k.Vb = function() {
            Y(this);
            var a = S(this),
                b = Wh(a.a, "widgetUrl");
            var c = si(a, b);
            S(this).a.get("popupMode") ? (a = (window.screen.availHeight - 600) / 2, b = (window.screen.availWidth - 500) / 2, c = c || "about:blank", a = {
                    width: 500,
                    height: 600,
                    top: 0 < a ? a : 0,
                    left: 0 < b ? b : 0,
                    location: !0,
                    resizable: !0,
                    statusbar: !0,
                    toolbar: !1
                },
                a.target = a.target || c.target || "google_popup", a.width = a.width || 690, a.height = a.height || 500, (a = qf(c, a)) && a.focus()) : rf(c)
        };

        function Y(a) {
            if (a.Z) throw Error("AuthUI instance is deleted!");
        }
        k.Wa = function() {
            var a = this;
            Y(this);
            return this.a.app.delete().then(function() {
                var b = xo(T(a));
                delete yo[b];
                a.reset();
                a.Z = !0
            })
        };

        function to(a) {
            Y(a);
            try {
                Sf(a.l, Ci(S(a)), Io(a)).then(function(b) {
                    return a.h ? Mm(a, a.h, b) : !1
                })
            } catch (b) {}
        }
        k.Hb = function(a, b) {
            Y(this);
            var c = this,
                d = xf();
            if (!Oi(S(this))) return ef(Error("Email link sign-in should be enabled to trigger email sending."));
            var e = Qi(S(this)),
                f = new Sb(e.url);
            Tb(f, d);
            b && b.a && (Th(d, b, T(this)), Wb(f, b.a.providerId));
            Ub(f, Pi(S(this)));
            return Ao(this, function(g) {
                g && ((g = g.uid) ? f.a.a.set(x.Pa, g) : Qb(f.a.a, x.Pa));
                e.url = f.toString();
                return X(c).sendSignInLinkToEmail(a, e)
            }).then(function() {
                var g = T(c),
                    h = {};
                h.email = a;
                Gh(Ch, bh(d, JSON.stringify(h)), g)
            }, function(g) {
                Fh(Dh, T(c));
                Fh(Ch, T(c));
                throw g;
            })
        };

        function Dn(a, b) {
            var c = Vb(new Sb(b));
            if (!c) return G(null);
            b = new F(function(d, e) {
                var f = bo(a).onAuthStateChanged(function(g) {
                    f();
                    g && g.isAnonymous &&
                        g.uid === c ? d(g) : g && g.isAnonymous && g.uid !== c ? e(Error("anonymous-user-mismatch")) : e(Error("anonymous-user-not-found"))
                });
                W(a, f)
            });
            W(a, b);
            return b
        }

        function Hn(a, b, c, d, e) {
            Y(a);
            var f = e || null,
                g = firebase.auth.EmailAuthProvider.credentialWithLink(c, d);
            c = f ? X(a).signInWithEmailLink(c, d).then(function(h) {
                return h.user.linkWithCredential(f)
            }).then(function() {
                return hn(a)
            }).then(function() {
                return Bo(a, {
                    code: "auth/email-already-in-use"
                }, f)
            }) : X(a).fetchSignInMethodsForEmail(c).then(function(h) {
                return h.length ? Bo(a, {
                    code: "auth/email-already-in-use"
                }, g) : b.linkWithCredential(g)
            });
            W(a, c);
            return c
        }

        function In(a, b, c, d) {
            Y(a);
            var e = d || null,
                f;
            b = X(a).signInWithEmailLink(b, c).then(function(g) {
                f = {
                    user: g.user,
                    credential: null,
                    operationType: g.operationType,
                    additionalUserInfo: g.additionalUserInfo
                };
                if (e) return g.user.linkWithCredential(e).then(function(h) {
                    f = {
                        user: h.user,
                        credential: e,
                        operationType: f.operationType,
                        additionalUserInfo: h.additionalUserInfo
                    }
                })
            }).then(function() {
                hn(a)
            }).then(function() {
                return bo(a).updateCurrentUser(f.user)
            }).then(function() {
                f.user =
                    bo(a).currentUser;
                return f
            });
            W(a, b);
            return b
        }

        function Zm() {
            var a = vf();
            if (Do(a)) {
                a = new Sb(a);
                for (var b in x) x.hasOwnProperty(b) && Qb(a.a.a, x[b]);
                b = {
                    state: "signIn",
                    mode: "emailLink",
                    operation: "clear"
                };
                var c = n.document.title;
                n.history && n.history.replaceState && n.history.replaceState(b, c, a.toString())
            }
        }
        k.ac = function(a, b) {
            Y(this);
            var c = this;
            return X(this).signInWithEmailAndPassword(a, b).then(function(d) {
                return Ao(c, function(e) {
                    return e ? hn(c).then(function() {
                        return Bo(c, {
                                code: "auth/email-already-in-use"
                            },
                            firebase.auth.EmailAuthProvider.credential(a, b))
                    }) : d
                })
            })
        };
        k.Xb = function(a, b) {
            Y(this);
            var c = this;
            return Ao(this, function(d) {
                if (d) {
                    var e = firebase.auth.EmailAuthProvider.credential(a, b);
                    return d.linkWithCredential(e)
                }
                return X(c).createUserWithEmailAndPassword(a, b)
            })
        };
        k.$b = function(a) {
            Y(this);
            var b = this;
            return Ao(this, function(c) {
                return c ? c.linkWithCredential(a).then(function(d) {
                    return d
                }, function(d) {
                    if (d && "auth/email-already-in-use" == d.code && d.email && d.credential) throw d;
                    return Bo(b, d, a)
                }) : X(b).signInWithCredential(a)
            })
        };

        function Km(a, b) {
            Y(a);
            return Ao(a, function(c) {
                return c && !Mh(T(a)) ? c.linkWithPopup(b).then(function(d) {
                    return d
                }, function(d) {
                    if (d && "auth/email-already-in-use" == d.code && d.email && d.credential) throw d;
                    return Bo(a, d)
                }) : X(a).signInWithPopup(b)
            })
        }
        k.cc = function(a) {
            Y(this);
            var b = this,
                c = this.i;
            this.i = null;
            return Ao(this, function(d) {
                return d && !Mh(T(b)) ? d.linkWithRedirect(a) : X(b).signInWithRedirect(a)
            }).then(function() {}, function(d) {
                b.i = c;
                throw d;
            })
        };
        k.bc = function(a, b) {
            Y(this);
            var c = this;
            return Ao(this, function(d) {
                return d ?
                    d.linkWithPhoneNumber(a, b).then(function(e) {
                        return new Vf(e, function(f) {
                            if ("auth/credential-already-in-use" == f.code) return Bo(c, f);
                            throw f;
                        })
                    }) : bo(c).signInWithPhoneNumber(a, b).then(function(e) {
                        return new Vf(e)
                    })
            })
        };
        k.Zb = function() {
            Y(this);
            return bo(this).signInAnonymously()
        };

        function Fm(a, b) {
            Y(a);
            return Ao(a, function(c) {
                if (a.j && !a.j.isAnonymous && ui(S(a)) && !X(a).currentUser) return hn(a).then(function() {
                    "password" == b.credential.providerId && (b.credential = null);
                    return b
                });
                if (c) return hn(a).then(function() {
                    return c.linkWithCredential(b.credential)
                }).then(function(d) {
                    b.user =
                        d.user;
                    b.credential = d.credential;
                    b.operationType = d.operationType;
                    b.additionalUserInfo = d.additionalUserInfo;
                    return b
                }, function(d) {
                    if (d && "auth/email-already-in-use" == d.code && d.email && d.credential) throw d;
                    return Bo(a, d, b.credential)
                });
                if (!b.user) throw Error('Internal error: An incompatible or outdated version of "firebase.js" may be used.');
                return hn(a).then(function() {
                    return bo(a).updateCurrentUser(b.user)
                }).then(function() {
                    b.user = bo(a).currentUser;
                    b.operationType = "signIn";
                    b.credential && b.credential.providerId &&
                        "password" == b.credential.providerId && (b.credential = null);
                    return b
                })
            })
        }
        k.Wb = function(a, b) {
            Y(this);
            return X(this).signInWithEmailAndPassword(a, b)
        };

        function hn(a) {
            Y(a);
            return X(a).signOut()
        }

        function Bo(a, b, c) {
            Y(a);
            if (b && b.code && ("auth/email-already-in-use" == b.code || "auth/credential-already-in-use" == b.code)) {
                var d = vi(S(a));
                return G().then(function() {
                    return d(new Pd("anonymous-upgrade-merge-conflict", null, c || b.credential))
                }).then(function() {
                    a.h && (a.h.o(), a.h = null);
                    throw b;
                })
            }
            return ef(b)
        }

        function Jo(a,
            b, c, d) {
            P.call(this, Ql, void 0, d, "providerMatchByEmail", {
                G: b,
                F: c
            });
            this.i = a
        }
        m(Jo, P);
        Jo.prototype.v = function() {
            this.u(this.i);
            this.A(this.i);
            this.l().focus();
            xn(this.l(), (this.l().value || "").length);
            P.prototype.v.call(this)
        };
        Jo.prototype.m = function() {
            this.i = null;
            P.prototype.m.call(this)
        };
        u(Jo.prototype, {
            l: $l,
            I: am,
            u: bm,
            C: cm,
            j: dm,
            N: Rl,
            A: Tl
        });

        function Ko(a, b, c, d, e) {
            P.call(this, Pl, {
                dc: b
            }, e, "selectTenant", {
                G: c,
                F: d
            });
            this.i = a
        }
        m(Ko, P);
        Ko.prototype.v = function() {
            Lo(this, this.i);
            P.prototype.v.call(this)
        };
        Ko.prototype.m =
            function() {
                this.i = null;
                P.prototype.m.call(this)
            };

        function Lo(a, b) {
            function c(h) {
                b(h)
            }
            for (var d = a.g ? Vc("firebaseui-id-tenant-selection-button", a.g || a.s.a) : [], e = 0; e < d.length; e++) {
                var f = d[e],
                    g = eo(f, "tenantId");
                O(a, f, ya(c, g))
            }
        }

        function Mo(a) {
            P.call(this, kl, void 0, a, "spinner")
        }
        m(Mo, P);

        function No(a) {
            this.a = new Uh;
            H(this.a, "authDomain");
            H(this.a, "displayMode", Oo);
            H(this.a, "tenants");
            H(this.a, "callbacks");
            H(this.a, "tosUrl");
            H(this.a, "privacyPolicyUrl");
            for (var b in a)
                if (a.hasOwnProperty(b)) try {
                    Vh(this.a,
                        b, a[b])
                } catch (c) {
                    rg('Invalid config: "' + b + '"', void 0)
                }
        }

        function Po(a) {
            a = a.a.get("displayMode");
            for (var b in Qo)
                if (Qo[b] === a) return Qo[b];
            return Oo
        }

        function Ro(a) {
            return a.a.get("callbacks") || {}
        }

        function So(a) {
            var b = a.a.get("tosUrl") || null;
            a = a.a.get("privacyPolicyUrl") || null;
            b && !a && wg("Privacy Policy URL is missing, the link will not be displayed.");
            if (b && a) {
                if ("function" === typeof b) return b;
                if ("string" === typeof b) return function() {
                    tf(b)
                }
            }
            return null
        }

        function To(a) {
            var b = a.a.get("tosUrl") || null,
                c =
                a.a.get("privacyPolicyUrl") || null;
            c && !b && wg("Terms of Service URL is missing, the link will not be displayed.");
            if (b && c) {
                if ("function" === typeof c) return c;
                if ("string" === typeof c) return function() {
                    tf(c)
                }
            }
            return null
        }

        function Uo(a, b) {
            a = a.a.get("tenants");
            if (!a || !a.hasOwnProperty(b) && !a.hasOwnProperty(Vo)) throw Error("Invalid tenant configuration!");
        }

        function Wo(a, b, c) {
            a = a.a.get("tenants");
            if (!a) throw Error("Invalid tenant configuration!");
            var d = [];
            a = a[b] || a[Vo];
            if (!a) return rg("Invalid tenant configuration: " +
                (b + " is not configured!"), void 0), d;
            b = a.signInOptions;
            if (!b) throw Error("Invalid tenant configuration: signInOptions are invalid!");
            b.forEach(function(e) {
                if ("string" === typeof e) d.push(e);
                else if ("string" === typeof e.provider) {
                    var f = e.hd;
                    f && c ? (f instanceof RegExp ? f : new RegExp("@" + f.replace(".", "\\.") + "$")).test(c) && d.push(e.provider) : d.push(e.provider)
                } else e = "Invalid tenant configuration: signInOption " + (JSON.stringify(e) + " is invalid!"), rg(e, void 0)
            });
            return d
        }

        function Xo(a, b, c) {
            a = Yo(a, b);
            (b = a.signInOptions) &&
            c && (b = b.filter(function(d) {
                return "string" === typeof d ? c.includes(d) : c.includes(d.provider)
            }), a.signInOptions = b);
            return a
        }

        function Yo(a, b) {
            var c = Zo;
            var d = void 0 === d ? {} : d;
            Uo(a, b);
            a = a.a.get("tenants");
            return yf(a[b] || a[Vo], c, d)
        }
        var Zo = ["immediateFederatedRedirect", "privacyPolicyUrl", "signInFlow", "signInOptions", "tosUrl"],
            Oo = "optionFirst",
            Qo = {
                oc: Oo,
                nc: "identifierFirst"
            },
            Vo = "*";

        function $o(a, b) {
            var c = this;
            this.s = uf(a);
            this.a = {};
            Object.keys(b).forEach(function(d) {
                c.a[d] = new No(b[d])
            });
            this.ob = this.g = this.B =
                this.h = this.i = this.j = null;
            Object.defineProperty(this, "languageCode", {
                get: function() {
                    return this.ob
                },
                set: function(d) {
                    this.ob = d || null
                },
                enumerable: !1
            })
        }
        k = $o.prototype;
        k.Tb = function(a, b) {
            var c = this;
            ap(this);
            var d = a.apiKey;
            return new F(function(e, f) {
                if (c.a.hasOwnProperty(d)) {
                    var g = Ro(c.a[d]).selectTenantUiHidden || null;
                    if (Po(c.a[d]) === Oo) {
                        var h = [];
                        b.forEach(function(r) {
                            r = r || "_";
                            var K = c.a[d].a.get("tenants");
                            if (!K) throw Error("Invalid tenant configuration!");
                            (K = K[r] || K[Vo]) ? r = {
                                tenantId: "_" !== r ? r : null,
                                displayName: K.displayName,
                                Ma: K.iconUrl,
                                Ga: K.buttonColor
                            }: (rg("Invalid tenant configuration: " + (r + " is not configured!"), void 0), r = null);
                            r && h.push(r)
                        });
                        var l = function(r) {
                            r = {
                                tenantId: r,
                                providerIds: Wo(c.a[d], r || "_")
                            };
                            e(r)
                        };
                        if (1 === h.length) {
                            l(h[0].tenantId);
                            return
                        }
                        c.g = new Ko(function(r) {
                            ap(c);
                            g && g();
                            l(r)
                        }, h, So(c.a[d]), To(c.a[d]))
                    } else c.g = new Jo(function() {
                            var r = c.g.j();
                            if (r) {
                                for (var K = 0; K < b.length; K++) {
                                    var Ea = Wo(c.a[d], b[K] || "_", r);
                                    if (0 !== Ea.length) {
                                        r = {
                                            tenantId: b[K],
                                            providerIds: Ea,
                                            email: r
                                        };
                                        ap(c);
                                        g && g();
                                        e(r);
                                        return
                                    }
                                }
                                c.g.a(Nd({
                                    code: "no-matching-tenant-for-email"
                                }).toString())
                            }
                        },
                        So(c.a[d]), To(c.a[d]));
                    c.g.render(c.s);
                    (f = Ro(c.a[d]).selectTenantUiShown || null) && f()
                } else {
                    var p = Error("Invalid project configuration: API key is invalid!");
                    p.code = "invalid-configuration";
                    c.pb(p);
                    f(p)
                }
            })
        };
        k.Ob = function(a, b) {
            if (!this.a.hasOwnProperty(a)) throw Error("Invalid project configuration: API key is invalid!");
            var c = b || void 0;
            Uo(this.a[a], b || "_");
            try {
                this.i = firebase.app(c).auth()
            } catch (e) {
                var d = this.a[a].a.get("authDomain");
                if (!d) throw Error("Invalid project configuration: authDomain is required!");
                a = firebase.initializeApp({
                    apiKey: a,
                    authDomain: d
                }, c);
                a.auth().tenantId = b;
                this.i = a.auth()
            }
            return this.i
        };
        k.Yb = function(a, b) {
            var c = this;
            return new F(function(d, e) {
                function f(K, Ea) {
                    c.j = new wo(a);
                    Eo(c.j, c.s, K, Ea)
                }
                var g = a.app.options.apiKey;
                c.a.hasOwnProperty(g) || e(Error("Invalid project configuration: API key is invalid!"));
                var h = Xo(c.a[g], a.tenantId || "_", b && b.providerIds);
                ap(c);
                e = {
                    signInSuccessWithAuthResult: function(K) {
                        d(K);
                        return !1
                    }
                };
                var l = Ro(c.a[g]).signInUiShown || null,
                    p = !1;
                e.uiChanged = function(K,
                    Ea) {
                    null === K && "callback" === Ea ? ((K = Xc("firebaseui-id-page-callback", c.s)) && wk(K), c.h = new Mo, c.h.render(c.s)) : p || null === K && "spinner" === Ea || "blank" === Ea || (c.h && (c.h.o(), c.h = null), p = !0, l && l(a.tenantId))
                };
                h.callbacks = e;
                h.credentialHelper = "none";
                var r;
                b && b.email && (r = {
                    emailHint: b.email
                });
                c.j ? c.j.Wa().then(function() {
                    f(h, r)
                }) : f(h, r)
            })
        };
        k.reset = function() {
            var a = this;
            return G().then(function() {
                a.j && a.j.Wa()
            }).then(function() {
                a.j = null;
                ap(a)
            })
        };
        k.Ub = function() {
            var a = this;
            this.h || this.B || (this.B = window.setTimeout(function() {
                ap(a);
                a.h = new Mo;
                a.g = a.h;
                a.h.render(a.s);
                a.B = null
            }, 500))
        };
        k.mb = function() {
            window.clearTimeout(this.B);
            this.B = null;
            this.h && (this.h.o(), this.h = null)
        };
        k.Bb = function() {
            ap(this);
            this.g = new lm;
            this.g.render(this.s);
            return G()
        };

        function ap(a) {
            a.j && a.j.reset();
            a.mb();
            a.g && a.g.o()
        }
        k.pb = function(a) {
            var b = this,
                c = Nd({
                    code: a.code
                }).toString() || a.message;
            ap(this);
            var d;
            a.retry && sa(a.retry) && (d = function() {
                b.reset();
                a.retry()
            });
            this.g = new pm(c, d);
            this.g.render(this.s)
        };
        k.Qb = function(a) {
            var b = this;
            return G().then(function() {
                var c =
                    b.i && b.i.app.options.apiKey;
                if (!b.a.hasOwnProperty(c)) throw Error("Invalid project configuration: API key is invalid!");
                Uo(b.a[c], a.tenantId || "_");
                if (!b.i.currentUser || b.i.currentUser.uid !== a.uid) throw Error("The user being processed does not match the signed in user!");
                return (c = Ro(b.a[c]).beforeSignInSuccess || null) ? c(a) : a
            }).then(function(c) {
                if (c.uid !== a.uid) throw Error("User with mismatching UID returned.");
                return c
            })
        };
        v("firebaseui.auth.FirebaseUiHandler", $o);
        v("firebaseui.auth.FirebaseUiHandler.prototype.selectTenant",
            $o.prototype.Tb);
        v("firebaseui.auth.FirebaseUiHandler.prototype.getAuth", $o.prototype.Ob);
        v("firebaseui.auth.FirebaseUiHandler.prototype.startSignIn", $o.prototype.Yb);
        v("firebaseui.auth.FirebaseUiHandler.prototype.reset", $o.prototype.reset);
        v("firebaseui.auth.FirebaseUiHandler.prototype.showProgressBar", $o.prototype.Ub);
        v("firebaseui.auth.FirebaseUiHandler.prototype.hideProgressBar", $o.prototype.mb);
        v("firebaseui.auth.FirebaseUiHandler.prototype.completeSignOut", $o.prototype.Bb);
        v("firebaseui.auth.FirebaseUiHandler.prototype.handleError",
            $o.prototype.pb);
        v("firebaseui.auth.FirebaseUiHandler.prototype.processUser", $o.prototype.Qb);
        v("firebaseui.auth.AuthUI", wo);
        v("firebaseui.auth.AuthUI.getInstance", function(a) {
            a = xo(a);
            return yo[a] ? yo[a] : null
        });
        v("firebaseui.auth.AuthUI.prototype.disableAutoSignIn", wo.prototype.Db);
        v("firebaseui.auth.AuthUI.prototype.start", wo.prototype.start);
        v("firebaseui.auth.AuthUI.prototype.setConfig", wo.prototype.ib);
        v("firebaseui.auth.AuthUI.prototype.signIn", wo.prototype.Vb);
        v("firebaseui.auth.AuthUI.prototype.reset",
            wo.prototype.reset);
        v("firebaseui.auth.AuthUI.prototype.delete", wo.prototype.Wa);
        v("firebaseui.auth.AuthUI.prototype.isPendingRedirect", wo.prototype.nb);
        v("firebaseui.auth.AuthUIError", Pd);
        v("firebaseui.auth.AuthUIError.prototype.toJSON", Pd.prototype.toJSON);
        v("firebaseui.auth.CredentialHelper.ACCOUNT_CHOOSER_COM", pi);
        v("firebaseui.auth.CredentialHelper.GOOGLE_YOLO", Ei);
        v("firebaseui.auth.CredentialHelper.NONE", Zi);
        v("firebaseui.auth.AnonymousAuthProvider.PROVIDER_ID", "anonymous");
        F.prototype["catch"] =
            F.prototype.ta;
        F.prototype["finally"] = F.prototype.ec
    }).apply(typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : window);
}).apply(typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : window);