
function BufferBasedRuleClass() {
    const DEFAULT_BUFFER_SIZE = 60;
    const DEFAULT_RESERVOIR_SIZE = 0.3 * DEFAULT_BUFFER_SIZE;
    const DEFAULT_CUSHION_SIZE = 0.6 * DEFAULT_BUFFER_SIZE;

    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    let DashMetrics = factory.getSingletonFactoryByName('DashMetrics');
    let Debug = factory.getSingletonFactoryByName('Debug');
    let MetricsModel = factory.getSingletonFactoryByName('MetricsModel');

    let context = this.context;
    let instance,
        logger;

    function setUp() {
        logger = Debug(context).getInstance().getLogger(instance);
    }

    function getMinGreater(bitRateList, rateQuality) {
        let maxQuality = bitRateList.length - 1;
        let minGreater = rateQuality + 1;
        if(rateQuality > maxQuality){
            return maxQuality;
        } else {
            return minGreater;
        }
    }

    function getMaxSmaller(bitRateList, rateQuality) {
        let minQuality = 0;
        let maxSmaller = rateQuality - 1;
        if(rateQuality < minQuality){
            return minQuality;
        } else {
            return maxSmaller;
        }
    }

    function getQualityRatePlus(qualityPrevious, bitRateList){
        let ratePlus = qualityPrevious + 1;
        let maxQuality = bitRateList.length - 1;

        if(ratePlus > maxQuality){
            ratePlus = maxQuality;
        }
        return ratePlus;
    }

    function getQualityRateMinus(qualityPrevious, bitRateList){
        let rateMinus = qualityPrevious - 1;
        let minQuality = 0;

        if(rateMinus < minQuality){
            rateMinus = minQuality;
        }
        return rateMinus;
    }

    //Get slope of linear function based on highest quality and reservoir / cushion size
    function getSlope(bitRateList, reservoirSize, cushionSize){
        let y2 = bitRateList.length;
        let x2 = reservoirSize + cushionSize;
        let x1 = reservoirSize;
        return (y2 / (x2 - x1));

    }

    //Return which quality to play at based on buffer health
    function getRateMapValue(qualityPrevious, bitRateList, bufferLevel){
        if(bufferLevel <= DEFAULT_RESERVOIR_SIZE){
            return 0;
        }
        else if(bufferLevel >= DEFAULT_RESERVOIR_SIZE + DEFAULT_CUSHION_SIZE) {
            return bitRateList.length - 1;
        }
        else {
            let slope = getSlope(bitRateList, DEFAULT_RESERVOIR_SIZE, DEFAULT_CUSHION_SIZE);
            return Math.ceil(slope * (bufferLevel - DEFAULT_RESERVOIR_SIZE));
        }
    }

    function getBytesLength(request) {
        return request.trace.reduce((a, b) => a + b.b[0], 0);
    }

    function getStartUpQuality(qualityPrevious, lastRequest, bitRateList){
        if(lastRequest === null){
            return 0;
        }

        //Calculate Delta B
        let downloadBytes = getBytesLength(lastRequest);
        let latencyTime = lastRequest.tresponse.getTime() - lastRequest.trequest.getTime() || 1;
        let downloadTime = lastRequest._tfinish.getTime() - lastRequest.tresponse.getTime() || 1;

        let throughput = Math.round((8 * downloadBytes) / downloadTime + latencyTime);

        //Suggest next quality if Delta B > 0.875 * V
        let deltaB = 4 - ( downloadBytes / throughput); //CHECK
        if(deltaB > (0.875 * 4)){
            return getMinGreater(bitRateList, qualityPrevious);
        } else {
            return qualityPrevious;
        }


    }

    function getNextQuality(bufferLevel, qualityPrevious, bitRateList){
        let rateMax = bitRateList.length - 1;
        let rateMin = 0;
        let ratePlus = getQualityRatePlus(qualityPrevious, bitRateList);
        let rateMinus = getQualityRateMinus(qualityPrevious, bitRateList);
        let qualityEstimate = getRateMapValue(qualityPrevious, bitRateList, bufferLevel);

        let rateNext;
        if(qualityEstimate >= rateMax){
            rateNext = rateMax;
        }
        else if (qualityEstimate <= rateMin){
            rateNext = rateMin;
        }
        else if(qualityEstimate >= ratePlus){
            rateNext = getMinGreater(bitRateList, qualityEstimate);
        }
        else if(qualityEstimate <= rateMinus){
            rateNext = getMaxSmaller(bitRateList, qualityEstimate);
        }
        else {
            rateNext = qualityPrevious;
        }

        // console.log("Rate Next: " + rateNext);
        return rateNext;
    }


    function getMaxIndex(rulesContext) {

        let mediaType = rulesContext.getMediaInfo().type;
        let switchRequest = SwitchRequest(context).create();
        if(mediaType === "audio"){
            switchRequest.quality = 0;
            switchRequest.priority = SwitchRequest.PRIORITY.DEFAULT;
        } else {

            //Get information on metrics
            let dashMetrics = DashMetrics(context).getInstance();
            let metricsModel = MetricsModel(context).getInstance();
            let metrics = metricsModel.getMetricsFor(mediaType, true);
            let abrController = rulesContext.getAbrController();

            //Get last request information for start up
            let lastHttpRequest = dashMetrics.getCurrentHttpRequest(mediaType);


            //Get Quality information
            let currentQuality = abrController.getQualityFor(mediaType);
            let bitrateList = rulesContext.getMediaInfo().bitrateList;

            //Get current buffer health
            let bufferLevel = dashMetrics.getCurrentBufferLevel(mediaType);
            // console.log(bufferLevel + " secs");

            let nextQuality = getNextQuality(bufferLevel, currentQuality, bitrateList);
            let startUpQuality = getStartUpQuality(currentQuality, lastHttpRequest, bitrateList)
            // console.log("Startup:" + startUpQuality + " Next: " + nextQuality);

            //Check whether to use buffer based quality or start up quality
            if(nextQuality > startUpQuality){
                switchRequest.quality = nextQuality;
            } else {
                switchRequest.quality = startUpQuality;
            }

            switchRequest.priority = SwitchRequest.PRIORITY.DEFAULT;
        }

        return switchRequest

    }

    instance = {
        getMaxIndex: getMaxIndex
    };

    setUp();

    return instance;

}

BufferBasedRuleClass.__dashjs_factory_name = 'BufferBasedRule';
BufferBasedRule = dashjs.FactoryMaker.getClassFactory(BufferBasedRuleClass);