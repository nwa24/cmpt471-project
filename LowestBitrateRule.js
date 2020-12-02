var LowestBitrateRule;

// Rule that selects the lowest possible bitrate
function LowestBitrateRuleClass() {

    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    let MetricsModel = factory.getSingletonFactoryByName('MetricsModel');
    let StreamController = factory.getSingletonFactoryByName('StreamController');
    let context = this.context;
    let instance;

    function setup() {
    }

    // Always use lowest bitrate
    function getMaxIndex(rulesContext) {
        // here you can get some information about metrics for example, to implement the rule
        let metricsModel = MetricsModel(context).getInstance();
        var mediaType = rulesContext.getMediaInfo().type;
        var metrics = metricsModel.getMetricsFor(mediaType, true);

        console.log(metrics.getMaxQuality())

        // A smarter (real) rule could need analyze playback metrics to take
        // bitrate switching decision. Printing metrics here as a reference
        console.log(metrics);

        // Get current bitrate
        let streamController = StreamController(context).getInstance();
        let abrController = rulesContext.getAbrController();
        let current = abrController.getQualityFor(mediaType, streamController.getActiveStreamInfo());

        // If already in lowest bitrate, don't do anything
        if (current === 0) {
            return SwitchRequest(context).create();
        }

        // Ask to switch to the lowest bitrate
        let switchRequest = SwitchRequest(context).create();
        switchRequest.quality = 0;
        switchRequest.reason = 'Always switching to the lowest bitrate';
        switchRequest.priority = SwitchRequest.PRIORITY.STRONG;
        return switchRequest;
    }

    instance = {
        getMaxIndex: getMaxIndex
    };

    setup();

    return instance;
}

LowestBitrateRuleClass.__dashjs_factory_name = 'LowestBitrateRule';
LowestBitrateRule = dashjs.FactoryMaker.getClassFactory(LowestBitrateRuleClass);