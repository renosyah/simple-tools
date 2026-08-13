/**
 * Vue 2 mixin — pan / zoom viewport (matches service_flow_visualizer gestures).
 * Usage: mixins: [CanvasViewportMixin], ref="viewport" on workspace element.
 */
(function (global) {
  function isEditableTarget(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  global.CanvasViewportMixin = {
    data: function () {
      return {
        vpZoom: 1,
        vpPanX: 0,
        vpPanY: 0,
        vpSpace: false,
        _vpTouch: null
      };
    },
    computed: {
      vpTransformStyle: function () {
        return {
          transform: "translate(" + this.vpPanX + "px," + this.vpPanY + "px) scale(" + this.vpZoom + ")"
        };
      },
      vpZoomLabel: function () {
        return Math.round(this.vpZoom * 100) + "%";
      }
    },
    mounted: function () {
      this.vpBind();
    },
    beforeDestroy: function () {
      this.vpUnbind();
    },
    methods: {
      vpBind: function () {
        var self = this;
        this._vpOnKeyDown = function (e) {
          if (e.code === "Space" && !isEditableTarget(document.activeElement)) {
            self.vpSpace = true;
            e.preventDefault();
          }
        };
        this._vpOnKeyUp = function (e) {
          if (e.code === "Space") self.vpSpace = false;
        };
        document.addEventListener("keydown", this._vpOnKeyDown);
        document.addEventListener("keyup", this._vpOnKeyUp);
        this.$nextTick(function () {
          var el = self.vpGetEl();
          if (!el) return;
          self._vpOnWheel = function (e) {
            e.preventDefault();
            self.vpChangeZoom(e.deltaY < 0 ? 0.1 : -0.1, e);
          };
          self._vpOnMouseDown = function (e) {
            if (e.button !== 1 && !self.vpSpace) return;
            if (self.vpShouldIgnorePan && self.vpShouldIgnorePan(e)) return;
            e.preventDefault();
            var sx = e.clientX, sy = e.clientY, px = self.vpPanX, py = self.vpPanY;
            function mv(v) {
              self.vpPanX = px + v.clientX - sx;
              self.vpPanY = py + v.clientY - sy;
            }
            function up() {
              document.removeEventListener("mousemove", mv);
              document.removeEventListener("mouseup", up);
            }
            document.addEventListener("mousemove", mv);
            document.addEventListener("mouseup", up);
          };
          self._vpOnTouchStart = function (e) {
            if (self.vpShouldIgnorePan && self.vpShouldIgnorePan(e)) return;
            if (e.touches.length === 1) {
              var t = e.touches[0];
              self._vpTouch = { mode: "pan", sx: t.clientX, sy: t.clientY, px: self.vpPanX, py: self.vpPanY };
            } else if (e.touches.length === 2) {
              var a = e.touches[0], b = e.touches[1];
              var dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
              var cx = (a.clientX + b.clientX) / 2, cy = (a.clientY + b.clientY) / 2;
              var r = el.getBoundingClientRect();
              self._vpTouch = {
                mode: "pinch", dist: dist, zoom: self.vpZoom,
                mx: cx - r.left, my: cy - r.top,
                panX: self.vpPanX, panY: self.vpPanY
              };
            }
          };
          self._vpOnTouchMove = function (e) {
            if (!self._vpTouch) return;
            e.preventDefault();
            if (self._vpTouch.mode === "pan" && e.touches.length === 1) {
              var t = e.touches[0];
              self.vpPanX = self._vpTouch.px + t.clientX - self._vpTouch.sx;
              self.vpPanY = self._vpTouch.py + t.clientY - self._vpTouch.sy;
            } else if (self._vpTouch.mode === "pinch" && e.touches.length === 2) {
              var a = e.touches[0], b = e.touches[1];
              var dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
              var cx = (a.clientX + b.clientX) / 2, cy = (a.clientY + b.clientY) / 2;
              var r = el.getBoundingClientRect();
              var mx = cx - r.left, my = cy - r.top;
              var newZoom = Math.max(0.25, Math.min(2.5, self._vpTouch.zoom * (dist / self._vpTouch.dist)));
              var k = newZoom / self.vpZoom;
              self.vpPanX = mx - (mx - self.vpPanX) * k;
              self.vpPanY = my - (my - self.vpPanY) * k;
              self.vpZoom = +newZoom.toFixed(2);
            }
          };
          self._vpOnTouchEnd = function () { self._vpTouch = null; };
          el.addEventListener("wheel", self._vpOnWheel, { passive: false });
          el.addEventListener("mousedown", self._vpOnMouseDown);
          el.addEventListener("touchstart", self._vpOnTouchStart, { passive: false });
          el.addEventListener("touchmove", self._vpOnTouchMove, { passive: false });
          el.addEventListener("touchend", self._vpOnTouchEnd);
          el.addEventListener("touchcancel", self._vpOnTouchEnd);
        });
      },
      vpUnbind: function () {
        document.removeEventListener("keydown", this._vpOnKeyDown);
        document.removeEventListener("keyup", this._vpOnKeyUp);
        var el = this.vpGetEl();
        if (!el || !this._vpOnWheel) return;
        el.removeEventListener("wheel", this._vpOnWheel);
        el.removeEventListener("mousedown", this._vpOnMouseDown);
        el.removeEventListener("touchstart", this._vpOnTouchStart);
        el.removeEventListener("touchmove", this._vpOnTouchMove);
        el.removeEventListener("touchend", this._vpOnTouchEnd);
        el.removeEventListener("touchcancel", this._vpOnTouchEnd);
      },
      vpGetEl: function () {
        return this.$refs.viewport;
      },
      vpChangeZoom: function (delta, event) {
        var old = this.vpZoom;
        this.vpZoom = Math.max(0.25, Math.min(2.5, +(old + delta).toFixed(2)));
        if (event) {
          var el = this.vpGetEl();
          if (el) {
            var r = el.getBoundingClientRect();
            var mx = event.clientX - r.left;
            var my = event.clientY - r.top;
            var k = this.vpZoom / old;
            this.vpPanX = mx - (mx - this.vpPanX) * k;
            this.vpPanY = my - (my - this.vpPanY) * k;
          }
        }
      },
      vpZoomBy: function (delta) {
        this.vpChangeZoom(delta);
      },
      vpFit: function (bounds) {
        var el = this.vpGetEl();
        if (!el || !bounds) return;
        var w = Math.max(1, bounds.maxX - bounds.minX);
        var h = Math.max(1, bounds.maxY - bounds.minY);
        this.vpZoom = Math.max(0.25, Math.min(1.2, (el.clientWidth - 80) / w, (el.clientHeight - 80) / h));
        this.vpPanX = (el.clientWidth - w * this.vpZoom) / 2 - bounds.minX * this.vpZoom;
        this.vpPanY = (el.clientHeight - h * this.vpZoom) / 2 - bounds.minY * this.vpZoom;
      },
      vpCenterOn: function (x, y, ox, oy) {
        var el = this.vpGetEl();
        if (!el) return;
        ox = ox || 0;
        oy = oy || 0;
        this.vpPanX = el.clientWidth / 2 - (x + ox) * this.vpZoom;
        this.vpPanY = el.clientHeight / 2 - (y + oy) * this.vpZoom;
      },
      vpShouldIgnorePan: function () {
        return false;
      }
    }
  };
})(window);
