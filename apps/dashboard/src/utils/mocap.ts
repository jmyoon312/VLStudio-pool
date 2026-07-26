import { Holistic, Results } from '@mediapipe/holistic';
import * as Kalidokit from 'kalidokit';

export class MotionCapture {
    private holistic: Holistic;
    private onResultsCallback: (rig: any) => void;

    constructor(onResults: (rig: any) => void) {
        this.onResultsCallback = onResults;

        this.holistic = new Holistic({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
            }
        });

        this.holistic.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            refineFaceLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.holistic.onResults(this.handleResults.bind(this));
    }

    private handleResults(results: Results) {
        // Solve Pose, Face, Hands using Kalidokit
        // Solve Pose, Face, Hands using Kalidokit
        const rig: any = {
            pose: null,
            face: null,
            leftHand: null,
            rightHand: null
        };

        if (results.poseLandmarks && (results as any).poseWorldLandmarks) {
            rig.pose = Kalidokit.Pose.solve((results as any).poseWorldLandmarks, results.poseLandmarks, {
                runtime: 'mediapipe',
                video: undefined // Optional
            });
        }

        if (results.faceLandmarks) {
            rig.face = Kalidokit.Face.solve(results.faceLandmarks, {
                runtime: 'mediapipe'
            });
        }

        if (results.leftHandLandmarks) {
            rig.leftHand = Kalidokit.Hand.solve(results.leftHandLandmarks, "Left");
        }

        if (results.rightHandLandmarks) {
            rig.rightHand = Kalidokit.Hand.solve(results.rightHandLandmarks, "Right");
        }

        this.onResultsCallback(rig);
    }

    public async send(videoElement: HTMLVideoElement) {
        await this.holistic.send({ image: videoElement });
    }

    public close() {
        this.holistic.close();
    }
}
