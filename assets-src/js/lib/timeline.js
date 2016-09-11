// Let's show events as fast as the browser can render them to avoid choking
// Especially useful on mobile / weaker CPUs
window.requestAnimFrame = (function() {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function(callback) {
            window.setTimeout(callback, 100);
        };
})();

function Timeline() {

    this.scrubber = null;
    this.speed = configDefaults.speed;
    this.timeJump = 1;
    this.timePointer = 0;
    this.playing = false;
    this.now;
    this.then = Date.now();
    this.delta;
    this.timeBounds = {
        "min": 0,
        "max": 0
    };
};

Timeline.prototype.setupScrubber = function(eventList) {

    var self = this;

    this.timeBounds.min = parseInt(eventList[0].missionTime);
    this.timeBounds.max = parseInt(eventList[eventList.length - 1].missionTime);

    // Has the user shared a playback with a specific speed?
    if (typeof playBack.sharedPresets.speed !== "undefined")
        this.speed = playBack.sharedPresets.speed;

    this.scrubber = document.getElementById('timeline__silder');

    $('.timeline__silder__value').html(0);
    $('.timeline').removeClass('timeline--loading');

    this.timePointer = this.timeBounds.min;

    noUiSlider.create(this.scrubber, {
        start: this.timeBounds.min,
        animate: false,
        connect: 'lower',
        step: 1,
        range: {
            'min': this.timeBounds.min,
            'max': this.timeBounds.max
        }
    });

    //playBack.scrubber.noUiSlider.set(0);
    this.setupInteractionHandlers();
};

Timeline.prototype.setupInteractionHandlers = function() {

    var self = this;

    this.scrubber.noUiSlider.on('slide', function(value) {

        console.log('Sliding', Math.round(value[0]));

        self.skipTime(value[0]);
    });

    $('body').on('click', '.timeline__toggle-playback', function(e) {
        e.preventDefault();

        if (!self.playing) {

            $('.timeline__toggle-playback .fa').removeClass('fa-play').addClass('fa-pause');
            self.startTimer();

        } else {

            $('.timeline__toggle-playback .fa').removeClass('fa-pause').addClass('fa-play');
            self.stopTimer();
        }
    });

    $('body').on('click', '.timeline__speed', function(e) {

        e.preventDefault();

        self.changeSpeed($(this).data('speed'));
    });

    $('body').on('click', '.timeline__share', function(e) {
        e.preventDefault();

        self.stopTimer();

        var shareUrl = webPath + '/' + playBack.replayDetails.id + '/' + playBack.replayDetails.slug + '?playback';

        var center = playBack.map.handler.getCenter();
        shareUrl += '&centerLat=' + center.lat;
        shareUrl += '&centerLng=' + center.lng;

        shareUrl += '&zoom=' + playBack.map.handler.getZoom();
        shareUrl += '&time=' + self.timePointer;
        shareUrl += '&speed=' + self.speed;

        if (playBack.trackTarget)
            shareUrl += '&track=' + playBack.trackTarget

        $('.timeline__share__details input').val(shareUrl);

        // Show modal here
    });

    $('body').on('click', '.timeline__fullscreen', function(e) {

        e.preventDefault();

        if (screenfull.enabled) {
            screenfull.toggle();
        }
    });
}

Timeline.prototype.changeSpeed = function(speed) {

    $('.timeline__speed--active').removeClass('timeline__speed--active');

    $('.timeline__speed[data-speed="' + speed + '"]').addClass('timeline__speed--active');

    this.speed = speed;

    // If we increase the speed too much chances are the browser can't
    // keep up with the rendering so we need to start skipping events entirely
    if(this.speed == 60)
        this.timeJump = 5;
    else
        this.timeJump = 1;
}

Timeline.prototype.skipTime = function(value) {

    this.timePointer = Math.round(value);

    // Clear down the map of existing markers, ready to time warp...
    markers.eventGroups.positions_vehicles.clearLayers();
    markers.eventGroups.positions_infantry.clearLayers();
    markers.list = {};
    markers.currentUnits.positions_vehicles = [];
    markers.currentUnits.positions_infantry = [];

    if (!this.playing)
        this.startTimer();
};

Timeline.prototype.startTimer = function () {

    var self = this;

    this.stopTimer();

    this.playing = true;

    $('.timeline__toggle-playback .fa').removeClass('fa-play').addClass('fa-pause');

    if (playBack.sharedPresets.trackPlayer)
        playBack.trackTarget = playBack.sharedPresets.trackPlayer;

    (function animloop() {

        if (!self.playing)
            return;

        requestAnimFrame(animloop);

        self.now = Date.now();
        self.delta = self.now - self.then;

        var interval = 1000 / self.speed;

        if (self.delta > interval) {

            //console.log(self.timePointer, self.playing);

            self.scrubber.noUiSlider.set(self.timePointer);

            var date = new Date(null);
            date.setSeconds(self.timePointer);

            $('.noUi-handle').html(date.toISOString().substr(11, 8));

            if (parseInt($('.noUi-origin').css('left')) > 70)
                $('.noUi-handle').addClass('left-time');
            else
                $('.noUi-handle').removeClass('left-time');

            if (self.timePointer >= self.timeBounds.max)
                self.stopTimer();
            else
                events.showNext();

            self.then = self.now - (self.delta % interval);
        }
    })();
};

Timeline.prototype.stopTimer = function() {

    this.playing = false;

    console.warn('Timer stopped');

    $('.timeline__toggle-playback .fa').removeClass('fa-pause').addClass('fa-play');
};