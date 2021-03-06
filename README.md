# CMPT 471 - Project

## Environment
Our code can only be run on Google Chrome Web Browser.

## How to run code
Each algorithm is located in its own directory. To run the video player open index.html within directory.

For the FESTIVE algorithm, it is best to have multiple players (i.e. 4) running the FESTIVE algorithm to see the effects of the algorithm. It is expected that all the players will eventually converge to a fair allocation of bitrate so no one player has a bias. To see the effects of the algorithm more strongly, have multiple players that are running the BBA algorithm to see how the two algorithms differ in handling multiple players.

For the buffer based algorithm (BBA), it can be either played alongside multiple other players or by itself. The algorithm will automatically adjust the quality according to the health of its own buffer. 
## Known issues
The FESTIVE Algorithm needs 20 completed requests to compute the harmonic mean bandwidth estimation. Due to this reason, in our implementation of the algorithm there are no bitrate switches in the initial phase until there are 20 completed requests.

The outlined buffer based algorithm (BBA1) within our paper suggests using a chunk map to better handle variable bitrate (VBR) videos however our selected video did not contain variable sized chunks, thus we have omitted this feature. 
