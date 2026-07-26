import json
import os
import uuid
import time

class CapCutGenerator:
    """
    CapCut PC 버전 표준 스키마(v7.5+)를 따르는 범용 프로젝트 생성기입니다.
    """
    def __init__(self, project_name="New Project", draft_id=None):
        self.project_id = draft_id if draft_id else str(uuid.uuid4()).upper()
        self.project_name = project_name
        self.fps = 30.0
        self.duration = 0 # Microseconds
        
        # 표준 스키마 초기 구조
        self.data = {
            "canvas_config": {"height": 1920, "width": 1080, "ratio": "9:16"},
            "config": {
                "maintrack_adsorb": True,
                "zoom_info_params": {"zoom_ratio": 1.0}
            },
            "id": self.project_id,
            "materials": {
                "videos": [],
                "audios": [],
                "texts": [],
                "speeds": [],
                "canvases": []
            },
            "tracks": [],
            "version": 360000
        }
        
        # 트랙 초기화 (기본 비디오 트랙 1, 오디오 트랙 1)
        self.video_track = self._create_track("video")
        self.audio_track = self._create_track("audio")
        self.text_track = self._create_track("text")
        self.data["tracks"] = [self.video_track, self.text_track, self.audio_track]

    def _create_track(self, track_type):
        return {
            "id": str(uuid.uuid4()).upper(),
            "type": track_type,
            "segments": []
        }

    def _to_ms(self, seconds):
        """초를 마이크로초(Microseconds)로 변환"""
        return int(seconds * 1000000)

    def add_video_segment(self, file_path, duration_sec, start_time_sec=None):
        """비디오/이미지 세그먼트 추가"""
        mat_id = str(uuid.uuid4()).upper()
        name = os.path.basename(file_path)
        duration_ms = self._to_ms(duration_sec)
        
        # 1. Materials 추가
        self.data["materials"]["videos"].append({
            "id": mat_id,
            "path": file_path.replace("\\", "/"),
            "name": name,
            "duration": duration_ms,
            "type": "video" if file_path.endswith(('.mp4', '.mov')) else "photo"
        })
        
        # 2. Track Segment 추가
        start_ms = self._to_ms(start_time_sec) if start_time_sec is not None else self.duration
        segment = {
            "id": str(uuid.uuid4()).upper(),
            "material_id": mat_id,
            "render_index": 0,
            "source_timerange": {"duration": duration_ms, "start": 0},
            "target_timerange": {"duration": duration_ms, "start": start_ms},
            "type": "video"
        }
        self.video_track["segments"].append(segment)
        
        # 전체 길이 업데이트
        if start_time_sec is None:
            self.duration += duration_ms
        else:
            self.duration = max(self.duration, start_ms + duration_ms)
            
        return mat_id

    def add_audio_segment(self, file_path, duration_sec, start_time_sec=0):
        """오디오(TTS/BGM) 세그먼트 추가"""
        mat_id = str(uuid.uuid4()).upper()
        duration_ms = self._to_ms(duration_sec)
        start_ms = self._to_ms(start_time_sec)
        
        self.data["materials"]["audios"].append({
            "id": mat_id,
            "path": file_path.replace("\\", "/"),
            "name": os.path.basename(file_path),
            "duration": duration_ms,
            "type": "extract_music"
        })
        
        segment = {
            "id": str(uuid.uuid4()).upper(),
            "material_id": mat_id,
            "source_timerange": {"duration": duration_ms, "start": 0},
            "target_timerange": {"duration": duration_ms, "start": start_ms},
            "type": "audio"
        }
        self.audio_track["segments"].append(segment)
        return mat_id

    def add_text_segment(self, content, start_time_sec, duration_sec):
        """자막/텍스트 세그먼트 추가"""
        mat_id = str(uuid.uuid4()).upper()
        
        # CapCut Text Material은 JSON 내부 JSON 문자열을 사용함
        text_content = {
            "text": content,
            "styles": [{"range": [0, len(content)], "size": 15}]
        }
        
        self.data["materials"]["texts"].append({
            "id": mat_id,
            "content": json.dumps(text_content, ensure_ascii=False),
            "type": "text"
        })
        
        start_ms = self._to_ms(start_time_sec)
        duration_ms = self._to_ms(duration_sec)
        
        segment = {
            "id": str(uuid.uuid4()).upper(),
            "material_id": mat_id,
            "target_timerange": {"duration": duration_ms, "start": start_ms},
            "type": "text"
        }
        self.text_track["segments"].append(segment)
        return mat_id

    def save_project(self, output_path):
        """최종 JSON 저장"""
        self.data["duration"] = self.duration
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(self.data, f, indent=4, ensure_ascii=False)
        return output_path
