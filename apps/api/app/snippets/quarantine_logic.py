from datetime import datetime, timedelta

# ... imports ...


# [Access Control Guard]
def verify_active_profile(profile: Profile):
    """ Enforce Quarantine Lock """
    if profile.status == ProfileStatus.QUARANTINED:
        release_date = "Unknown"
        if profile.quarantine_start_date:
            release_date = (profile.quarantine_start_date + timedelta(days=90)).strftime("%Y-%m-%d")
        
        detail_msg = f"격리 조치된 계정입니다. (해제 예정일: {release_date}) - 사유: {profile.quarantine_reason}"
        raise HTTPException(status_code=403, detail=detail_msg)


@router.post("/profiles/{id}/quarantine")
def quarantine_profile(id: str, reason: str = Body(..., embed=True), db: Session = Depends(get_db)):
    """ [Global Enforcement] Lock Profile for 90 Days """
    profile = db.query(Profile).filter(Profile.id == id).first()
    if not profile: raise HTTPException(404, "Profile not found")

    profile.status = ProfileStatus.QUARANTINED
    profile.quarantine_start_date = datetime.now()
    profile.quarantine_reason = reason
    db.commit()
    
    logger.warning(f"[ALERT] Profile {id} has been QUARANTINED. Reason: {reason}")
    return {"status": "quarantined", "msg": "90-day lockdown initiated"}


@router.post("/profiles/{id}/release")
def release_profile(id: str, db: Session = Depends(get_db)):
    """ [Manual Override] Release from Quarantine """
    profile = db.query(Profile).filter(Profile.id == id).first()
    if not profile: raise HTTPException(404, "Profile not found")

    profile.status = ProfileStatus.ACTIVE
    profile.quarantine_start_date = None
    profile.quarantine_reason = None
    db.commit()
    
    logger.info(f"[OK] Profile {id} manually released from quarantine.")
    return {"status": "released", "msg": "Account restored to ACTIVE status"}


@router.get("/profiles")
def list_profiles(type: str = None, db: Session = Depends(get_db)):
    query = db.query(Profile)
    if type:
        query = query.filter(Profile.profile_type == type)
    
    profiles = query.all()
    
    # [Auto-Release Check]
    if type == "TIN_CAN" or type is None:
        dirty = False
        now = datetime.now()
        for p in profiles:
            if p.status == ProfileStatus.QUARANTINED and p.quarantine_start_date:
                # 90 Days Expiry
                if now - p.quarantine_start_date >= timedelta(days=90):
                    print(f"🔓 [Auto-Release] {p.id} served 90 days. Restoring...")
                    p.status = ProfileStatus.ACTIVE
                    p.quarantine_start_date = None
                    p.quarantine_reason = None
                    dirty = True
        
        if dirty:
            db.commit()
            
    return profiles
