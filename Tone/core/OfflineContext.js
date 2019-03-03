import Tone from "../core/Tone";
import "../core/Context";
import "../shim/OfflineAudioContext";

/**
 *  @class Wrapper around the OfflineAudioContext
 *  @extends {Tone.Context}
	*  @param  {Number}  duration  The duration to render in samples
 */
Tone.OfflineContext = function(duration){
	/**
		*  A private reference to the duration
		*  @private
		*  @type  {Number}
		*/
	this._duration = duration;

	/**
		*  An artificial clock source
		*  @type  {Number}
		*  @private
		*/
	this._currentTime = 0;
};
Tone.extend(Tone.OfflineContext, Tone.Context);

Tone.OfflineContext.iframe = null;

/**
 *  Override the now method to point to the internal clock time
 *  @return  {Number}
 */
Tone.OfflineContext.prototype.now = function(){
	return this._currentTime;
};

/**
 *  Overwrite resume, should not do anything in the OfflineAudioContext.
 *  @return {Promise}
 */
Tone.OfflineContext.prototype.resume = function(){
	return Promise.resolve();
};

Tone.OfflineContext.prototype._createIframe = function() {
		return new Promise(resolve => {
			const iframe = document.createElement('iframe');
			iframe.style.display = 'none';
			iframe.onload = () => {
				const script = document.createElement('script');
				script.innerHTML =
								`
        var console = {
          __on : {},
          addEventListener : function (name, callback) {
            this.__on[name] = (this.__on[name] || []).concat(callback);
            return this;
          },
          dispatchEvent : function (name, value) {
            this.__on[name] = (this.__on[name] || []);
            for (var i = 0, n = this.__on[name].length; i < n; i++) {
              this.__on[name][i].call(this, value);
            }
            return this;
          },
          log: function () {
            var a = [];
            // For V8 optimization
            for (var i = 0, n = arguments.length; i < n; i++) {
              a.push(arguments[i]);
            }
            this.dispatchEvent("log", a);
          }
        };
        
        function createOfflineContext(channels, duration, sampleRate) {
											return new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(channels, duration, sampleRate);
        }
      `;
				iframe.contentDocument.body.appendChild(script);
				/*
				iframe.contentWindow.console.addEventListener("log", function (value) {
					console.log.apply(null, value);
				});
				console.log('iframe loaded');
				*/
				resolve(iframe);
			};
			document.body.appendChild(iframe);
		});
};

Tone.OfflineContext.prototype.destroy = function(){
	const iframe = Tone.OfflineContext.iframe;
	if(iframe) {
		// TODO, memory leak is not fixed
		Tone.OfflineContext.iframe = null;
		// Tone.OfflineContext.iframe.contentWindow.location.reload(true);
		const parent = iframe.parentNode;
		parent.removeChild(iframe);
	}
};

/**
	*
	*  @param  {Number}  channels  The number of channels to render
	*  @param  {Number}  duration  The duration to render in samples
	*  @param {Number} sampleRate the sample rate to render at
	* @returns {*|PromiseLike<T>|Promise<T>}
	*/
Tone.OfflineContext.prototype.init = function(channels, sampleRate){
	return this._createIframe()
					.then((iframe) => {
						Tone.OfflineContext.iframe = iframe;
						console.log('createIframe resolved');
						var offlineContext = iframe.contentWindow.createOfflineContext(
										channels,
										this._duration*sampleRate,
										sampleRate
						);

						//wrap the methods/members
						Tone.Context.call(this, {
							"context": offlineContext,
							"clockSource": "offline",
							"lookAhead": 0,
							"updateInterval": 128 / sampleRate
						});
					});
};

/**
 *  Render the output of the OfflineContext
 *  @return  {Promise}
 */
Tone.OfflineContext.prototype.render = function(){
  console.log('DEBUG_TONE_OFFLINE render no event logging!');

 /*
 this is too slow: https://github.com/Tonejs/Tone.js/issues/435#issuecomment-460103036
	while (this._duration - this._currentTime >= 0){
		//invoke all the callbacks on that time
		this.emit("tick");
		//increment the clock
		this._currentTime += this.blockTime;
	}
	*/

	return this._context.startRendering();
};

/**
 *  Close the context
 *  @return  {Promise}
 */
Tone.OfflineContext.prototype.close = function(){
	this._context = null;
	return Promise.resolve();
};

export default Tone.OfflineContext;

