
function BufferBased() {

    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    let MetricsModel = factory.getSingletonFactoryByName('MetricsModel');
    let context = this.context;
    let instance;

    function setUp() {
    }

    // Give bitrate based on buffer health
    function getMaxIndex(rulesContext) {
        //Get information on metrics
        let metricsModel = MetricsModel(context).getInstance();
        var mediaType = rulesContext.getMediaInfo.type;
        var metrics = metricsModel.getMetricsFor(mediaType, true);

        //Get current buffer health
        /**
         * Level of the buffer in milliseconds. Indicates the playout duration for which
         * media data of all active media components is available starting from the
         * current playout time.
         */
        let bufferLevel = metrics.getCurrentBufferLevel(mediaType)
        console.log(bufferLevel)

        /**
         * Current buffer state. Will be MetricsConstants.BUFFER_EMPTY or MetricsConstants.BUFFER_LOADED.
         *
         * TODO: Use buffer state to determine whether to use the start sequence
         */
        // let bufferState = metrics.getCurrentBufferState(mediaType)

        //return switch request
        var switchRequest = SwitchRequest(context).create()

        //change request depending on buffer level
        switch(bufferLevel){
            case bufferLevel > x:
                // switchRequest.quality =
                break;
            case bufferLevel === x:
                // switchRequest.quality =
                break;
            case bufferLevel < x:
                // switchRequest.quality = 0;
                break;
        }

        instance = {
            getMaxIndex: getMaxIndex
        };

        setUp();

        return switchRequest;

    }

}

// LowestBitrateRuleClass.__dashjs_factory_name = 'BufferBased';
// LowestBitrateRule = dashjs.FactoryMaker.getClassFactory(LowestBitrateRuleClass);