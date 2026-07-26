import json
import os
import time
from app.config import settings

class CapCutRegistryManager:
    """
    CapCut PC's root_meta_info.json 파일을 안전하게 업데이트하여 
    프로젝트를 캡컷 UI 목록에 즉시 등록하는 관리자 클래스입니다.
    """
    def __init__(self):
        # [Standardized] Support environment variable or default to standardized media path
        self.root_path = os.getenv("CAPCUT_PROJECTS_PATH", 
                                   os.path.join(settings.MEDIA_ROOT, "capcut_projects") if os.name != "nt" 
                                   else os.path.join(os.environ.get("LOCALAPPDATA", "C:"), r"CapCut\User Data\Projects\com.lveditor.draft"))
        self.meta_file = os.path.join(self.root_path, "root_meta_info.json")

    def register_project(self, project_name, folder_name, draft_id, duration_ms):
        """
        새 프로젝트를 root_meta_info.json에 등록하거나 기존 항목을 업데이트합니다.
        """
        if not os.path.exists(self.meta_file):
            print(f"Error: {self.meta_file} not found.")
            return False

        with open(self.meta_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 1. 기존 항목이 있는지 확인 (draft_id 기준)
        project_list = data.get("all_draft_store", [])
        existing_index = -1
        for i, proj in enumerate(project_list):
            if proj.get("draft_id") == draft_id:
                existing_index = i
                break

        # 2. 새로운 항목 생성 (캡컷 표준 포맷 준수)
        # 중요: draft_json_file은 반드시 '폴더\\draft_content.json' 형태여야 함 (역슬래시 2개)
        # 드라이브 문자는 대문자 'C:' 선호
        fold_path = os.path.join(self.root_path, folder_name).replace("\\", "/")
        if fold_path[0].islower():
            fold_path = fold_path[0].upper() + fold_path[1:]
            
        json_file_path = f"{fold_path}\\draft_content.json"
        cover_path = f"{fold_path}\\draft_cover.jpg"

        timestamp = int(time.time() * 1000000) # 마이크로초 단위 타이밍

        new_entry = {
            "cloud_draft_cover": False,
            "cloud_draft_sync": False,
            "draft_cloud_last_action_download": False,
            "draft_cloud_purchase_info": "",
            "draft_cloud_template_id": "",
            "draft_cloud_tutorial_info": "",
            "draft_cloud_videocut_purchase_info": "",
            "draft_cover": cover_path,
            "draft_fold_path": fold_path,
            "draft_id": draft_id,
            "draft_is_ai_shorts": False,
            "draft_is_cloud_temp_draft": False,
            "draft_is_invisible": False,
            "draft_is_web_article_video": False,
            "draft_json_file": json_file_path,
            "draft_name": project_name,
            "draft_new_version": "",
            "draft_root_path": self.root_path.replace("\\", "/"),
            "draft_timeline_materials_size": 0, # 생략 가능
            "draft_type": "",
            "draft_web_article_video_enter_from": "",
            "streaming_edit_draft_ready": True,
            "tm_draft_cloud_completed": "",
            "tm_draft_cloud_entry_id": -1,
            "tm_draft_cloud_modified": 0,
            "tm_draft_cloud_parent_entry_id": -1,
            "tm_draft_cloud_space_id": -1,
            "tm_draft_cloud_user_id": -1,
            "tm_draft_create": timestamp,
            "tm_draft_modified": timestamp,
            "tm_draft_removed": 0,
            "tm_duration": duration_ms
        }

        if existing_index >= 0:
            # 업데이트 시 생성 시각은 유지
            new_entry["tm_draft_create"] = project_list[existing_index].get("tm_draft_create", timestamp)
            project_list[existing_index] = new_entry
            print(f"Updated existing project: {project_name}")
        else:
            # 리스트의 맨 앞에 추가 (최근 프로젝트로 표시됨)
            project_list.insert(0, new_entry)
            print(f"Registered new project: {project_name}")

        data["all_draft_store"] = project_list

        # 3. 안전하게 저장 (임시 파일 거치기)
        temp_file = self.meta_file + ".tmp"
        with open(temp_file, 'w', encoding='utf-8') as f:
            # 캡컷은 보통 한 줄로 저장하거나 특정 포맷을 선호하므로 indent 없이 저장 시도
            json.dump(data, f, separators=(',', ':'), ensure_ascii=False)
        
        os.replace(temp_file, self.meta_file)
        return True
