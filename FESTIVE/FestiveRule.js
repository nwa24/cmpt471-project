var FestiveRule;

function FestiveRuleClass() {
  const MAX_MEASUREMENTS_TO_KEEP = 20;
  const TRADEOFF_FACTOR = 12;
  const MEDIA_SEGMENT = 'MediaSegment';
  const TIME_FRAME = 20; // secs

  const factory = dashjs.FactoryMaker;
  const SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
  const DashMetrics = factory.getSingletonFactoryByName('DashMetrics');
  const StreamController = factory.getSingletonFactoryByName('StreamController');
  const Debug = factory.getSingletonFactoryByName('Debug');

  let context = this.context;
  let instance, logger;

  let throughputDict = [];

  function setup() {
    logger = Debug(context).getInstance().getLogger(instance);
    resetInitialSettings();
  }

  function resetInitialSettings() {
    throughputDict['video'] = [];
    throughputDict['audio'] = [];
  }

  function getBytesLength(request) {
    return request.trace.reduce((a, b) => a + b.b[0], 0);
  }

  function computeHarmonicMean(mediaType) {
    let denominator = 0;
    for (let i = 0; i < throughputDict[mediaType].length; i++) {
      denominator += 1 / throughputDict[mediaType][i];
    }
    return throughputDict[mediaType].length / denominator;
  }

  function computeEfficienyCost(estimatedBandwidth, referenceBitrate, b) {
    return Math.abs(b / Math.min(estimatedBandwidth, referenceBitrate) - 1);
  }

  function computeStabilityCost(currentBitrate, referenceBitrate, numSwitches, b) {
    if (b == referenceBitrate) {
      return Math.pow(2, numSwitches) + 1;
    }

    if (b == currentBitrate) {
      return Math.pow(2, numSwitches);
    }
  }

  function getMaxIndex(rulesContext) {
    let mediaType = rulesContext.getMediaInfo().type;

    let dashMetrics = DashMetrics(context).getInstance();
    let streamController = StreamController(context).getInstance();
    let scheduleController = rulesContext.getScheduleController();
    let abrController = rulesContext.getAbrController();

    let currentQuality = abrController.getQualityFor(mediaType, streamController.getActiveStreamInfo());
    let bitrateList = rulesContext.getMediaInfo().bitrateList;

    let requests = dashMetrics.getHttpRequests(mediaType),
      lastRequest = null,
      currentRequest = null,
      switchRequest = SwitchRequest(context).create(),
      currentBufferLevel,
      targetBufferLevel,
      currentEndTime,
      chunkLength,
      randomBufferLevel,
      switchQuality = currentQuality,
      highestPossibleQuality = bitrateList.length - 1,
      referenceQuality = currentQuality;

    if (!requests) {
      logger.debug(`[FESTIVE][${mediaType}] No requests`);
      return switchRequest;
    }

    // get last valid request
    i = requests.length - 1;
    while (i >= 0 && lastRequest === null) {
      currentRequest = requests[i];
      if (currentRequest._tfinish && currentRequest.trequest && currentRequest.tresponse && currentRequest.trace && currentRequest.trace.length > 0) {
        lastRequest = requests[i];
      }
      i--;
    }

    if (lastRequest === null) {
      logger.debug(`[FESTIVE][${mediaType}] No valid requests made for this stream yet`);
      return switchRequest;
    }

    if (lastRequest.type !== 'MediaSegment') {
      logger.debug(`[FESTIVE][${mediaType}] Last request is not a media segment`);
      return switchRequest;
    }

    let latencyTime = lastRequest.tresponse.getTime() - lastRequest.trequest.getTime() || 1; // in milliseconds
    let downloadTime = lastRequest._tfinish.getTime() - lastRequest.tresponse.getTime() || 1; // in milliseconds

    let downloadBytes = getBytesLength(lastRequest);

    let throughput = Math.round((8 * downloadBytes) / downloadTime + latencyTime); // bits/ms = kbits/s

    throughputDict[mediaType].push(throughput);
    if (throughputDict[mediaType].length > MAX_MEASUREMENTS_TO_KEEP) {
      throughputDict[mediaType].shift();
    }

    /*   
      SELECTING A SUITABLE BITRATE FOR THE NEXT CHUNK
    */
    if (throughputDict[mediaType].length == MAX_MEASUREMENTS_TO_KEEP) {
      let estimatedBandwidth = Math.round(computeHarmonicMean(mediaType));

      /*
        BITRATE SELECTION
        - gradually switching 
      */
      let currentBitrate = Math.round(bitrateList[currentQuality].bandwidth / 1000); // kbits/sec
      let referenceBitrate = currentBitrate;

      // helps tolerate the buffer fluctuation caused by variability in chunk sizes
      let p = 0.85 * estimatedBandwidth;

      // if we need to decrease the bitrate
      if (currentBitrate > p) {
        referenceQuality = currentQuality == 0 ? currentQuality : currentQuality - 1;
        referenceBitrate = Math.round(bitrateList[referenceQuality].bandwidth / 1000);
      } else {
        // if we need to increase the bitrate to quality k only after k chunks
        if (currentQuality < highestPossibleQuality) {
          let count = 0;
          for (let i = requests.length - 1; i >= 0; i--) {
            if (requests[i].type == MEDIA_SEGMENT) {
              if (currentQuality == requests[i]._quality) {
                count++;
                if (count >= currentQuality + 1) {
                  break;
                }
              } else {
                break;
              }
            }
          }

          if (count >= currentQuality + 1 && currentBitrate <= estimatedBandwidth) {
            referenceQuality = currentQuality + 1;
            referenceBitrate = Math.round(bitrateList[referenceQuality].bandwidth / 1000);
          }
        }
      }

      /*
        DELAYED UPDATE
      */

      // the number of quality switches in the last 20 seconds
      let numSwitches = 0;

      for (let i = 0; i < requests.length; i++) {
        let req = requests[i];
        let time = new Date(new Date() - TIME_FRAME * 1000);
        let quality = currentQuality;
        // if it was then increase number of switches
        if (req.type == MEDIA_SEGMENT) {
          // determine if there was a quality change
          if (req._quality != quality) {
            quality = req._quality;
            // if there was a quality change -> was it within the last 20 seconds?
            if (req.tresponse >= time) {
              numSwitches++;
            }
          }
        }
      }

      let currentBitrateScore = (computeStabilityCost(currentBitrate, referenceBitrate, numSwitches, currentBitrate) + TRADEOFF_FACTOR) * computeEfficienyCost(estimatedBandwidth, referenceBitrate, currentBitrate);
      let referenceBitrateScore = (computeStabilityCost(currentBitrate, referenceBitrate, numSwitches, referenceBitrate) + TRADEOFF_FACTOR) * computeEfficienyCost(estimatedBandwidth, referenceBitrate, referenceBitrate);

      if (referenceBitrateScore < currentBitrateScore) {
        switchQuality = referenceQuality;
      }
    } else {
      // not enough completed requests to calculate
      switchQuality = currentQuality;
    }

    // updating the switch request
    if (switchQuality != currentQuality) {
      switchRequest.quality = switchQuality;
      switchRequest.reason = 'FESTIVE algorithm';
      switchRequest.priority = SwitchRequest.PRIORITY.STRONG;
    }

    /*  
      SCHEDULE WHEN THE NEXT CHUNK WILL BE DOWNLOADED (randomized scheduling based on the last request)
    */

    // all variables are in seconds
    currentBufferLevel = dashMetrics.getCurrentBufferLevel(mediaType);
    targetBufferLevel = scheduleController.getBufferTarget();
    currentStartTime = lastRequest.trequest.getTime() / 1000;
    currentEndTime = lastRequest.tresponse.getTime() / 1000;
    chunkLength = rulesContext.getRepresentationInfo().fragmentDuration;

    // generate a random number between (targetBufferLevel - chunkLength, targetBufferLevel + chunkLength]
    let max = targetBufferLevel + chunkLength;
    let min = targetBufferLevel - chunkLength;
    randomBufferLevel = Math.floor(Math.random() * (max - (min + 1) + 1) + (min + 1));

    let currentSchedulingInfo = dashMetrics.getCurrentSchedulingInfo(mediaType);

    // schedule the request time for the next chunk
    if (currentBufferLevel < randomBufferLevel) {
      let startTime = new Date(currentEndTime * 1000);
      let request = {
        mediaType: mediaType,
        type: MEDIA_SEGMENT,
        startTime: Math.round(currentSchedulingInfo.startTime + chunkLength),
        availabilityStartTime: startTime,
        duration: chunkLength,
        quality: currentSchedulingInfo.quality,
        range: currentSchedulingInfo.range,
      };
      dashMetrics.addSchedulingInfo(request, 'loading');
    } else {
      let startTime = new Date((currentEndTime + currentBufferLevel - randomBufferLevel) * 1000);
      let request = {
        mediaType: mediaType,
        type: MEDIA_SEGMENT,
        startTime: Math.round(currentSchedulingInfo.startTime + chunkLength),
        availabilityStartTime: startTime,
        duration: chunkLength,
        quality: currentSchedulingInfo.quality,
        range: currentSchedulingInfo.range,
      };
      dashMetrics.addSchedulingInfo(request, 'loading');
    }

    scheduleController.setTimeToLoadDelay(0);
    return switchRequest;
  }

  function reset() {
    resetInitialSettings();
  }

  instance = {
    getMaxIndex: getMaxIndex,
    reset: reset,
  };

  setup();

  return instance;
}

FestiveRuleClass.__dashjs_factory_name = 'FestiveRule';
FestiveRule = dashjs.FactoryMaker.getClassFactory(FestiveRuleClass);
