from __future__ import annotations

from uuid import uuid4
from datetime import datetime

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, Integer, JSON, text, Table, DDL, event
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from .base import Base


class User(Base):
    __tablename__ = "user"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email = Column(String)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")
    status = Column(String, nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Conversation(Base):
    __tablename__ = "conversation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"))
    title = Column(String)
    pinned = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Message(Base):
    __tablename__ = "message"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversation.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"))
    sender = Column(String, nullable=False)
    content = Column(Text)
    type = Column(String)
    scenario_session_id = Column(UUID(as_uuid=True), ForeignKey("scenario_session.id"))
    meta = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Scenario(Base):
    __tablename__ = "scenario"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    job = Column(String)
    version = Column(String)
    nodes = Column(JSONB)
    edges = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used_at = Column(DateTime(timezone=True))


class ScenarioSession(Base):
    __tablename__ = "scenario_session"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    scenario_id = Column(String, ForeignKey("scenario.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"))
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversation.id"))
    status = Column(String)
    current_node_id = Column(String)
    slots = Column(JSONB)
    context = Column(JSONB)
    messages = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    started_at = Column(DateTime(timezone=True))
    last_active_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))


class Notification(Base):
    __tablename__ = "notification"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"))
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversation.id"))
    scenario_session_id = Column(UUID(as_uuid=True), ForeignKey("scenario_session.id"))
    type = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class NxChatBotShrtCut(Base):
    __tablename__ = "nx_chat_bot_shrt_cut"
    __table_args__ = {"comment": "챗봇 숏컷 정보"}

    # --- Primary Keys ---
    ten_id: Mapped[str] = mapped_column(
        String(10), primary_key=True, comment="Tenant ID"
    )
    stg_id: Mapped[str] = mapped_column(
        String(10), primary_key=True, comment="Stage ID"
    )
    sec_ofc_id: Mapped[str] = mapped_column(
        String(6), primary_key=True, comment="Security Office Id"
    )
    shrt_cut_id: Mapped[str] = mapped_column(
        String(50), primary_key=True, comment="ShortCut ID"
    )

    # --- Shortcut Specific Columns ---
    usr_id: Mapped[str | None] = mapped_column(String(20), comment="User ID")
    par_shrt_cut_id: Mapped[str | None] = mapped_column(
        String(50), comment="Parent Shortcut Id"
    )
    shrt_cut_nm: Mapped[str | None] = mapped_column(
        String(100), comment="ShortCut Name"
    )
    shrt_cut_seq: Mapped[int | None] = mapped_column(
        Integer, comment="ShortCut Sequence"
    )

    # --- Audit Columns (Create) ---
    cre_usr_id: Mapped[str | None] = mapped_column(String(20), comment="Create User Id")
    # UTC 기준 생성일 (DB 서버 기준)
    cre_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("TIMEZONE('utc', CURRENT_TIMESTAMP)"),
        comment="Create Date (UTC)",
    )
    # 로컬 기준 생성일 (Python 서버 기준)
    lcl_cre_dt: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, comment="Local Create Date"
    )

    # --- Audit Columns (Update) ---
    upd_usr_id: Mapped[str | None] = mapped_column(String(20), comment="Update User Id")
    # UTC 기준 수정일
    upd_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("TIMEZONE('utc', CURRENT_TIMESTAMP)"),
        onupdate=text("TIMEZONE('utc', CURRENT_TIMESTAMP)"),
        comment="Update Date (UTC)",
    )
    # 로컬 기준 수정일
    lcl_upd_dt: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        comment="Local Update Date",
    )

class NxChatBotShrtCutItem(Base):
    __tablename__ = "nx_chat_bot_shrt_cut_item"
    __table_args__ = {"comment": "챗봇 숏컷 세부항목 정보"}

    # --- Primary Keys ---
    ten_id: Mapped[str] = mapped_column(
        String(10), primary_key=True, comment="Tenant ID"
    )
    stg_id: Mapped[str] = mapped_column(
        String(10), primary_key=True, comment="Stage ID"
    )
    sec_ofc_id: Mapped[str] = mapped_column(
        String(6), primary_key=True, comment="Security Office ID"
    )

    # serial 타입은 autoincrement=True로 설정합니다.
    item_id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="Item ID")

    # --- Item Specific Columns ---
    shrt_cut_id: Mapped[str | None] = mapped_column(String(50), comment="Shortcut Id")
    item_nm: Mapped[str | None] = mapped_column(String(100), comment="Item Name")
    item_des: Mapped[str | None] = mapped_column(
        String(2000), comment="Item Description"
    )

    # PostgreSQL JSONB 타입 적용
    shrt_evnt_act: Mapped[dict | None] = mapped_column(
        JSON, comment="Short Event Action"
    )
    item_seq: Mapped[int | None] = mapped_column(Integer, comment="Item Sequence")

    # --- Audit Columns (Create) ---
    cre_usr_id: Mapped[str | None] = mapped_column(String(20), comment="Create User Id")
    cre_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("TIMEZONE('utc', CURRENT_TIMESTAMP)"),
        comment="Create Date (UTC)",
    )
    lcl_cre_dt: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, comment="Local Create Date"
    )

    # --- Audit Columns (Update) ---
    upd_usr_id: Mapped[str | None] = mapped_column(String(20), comment="Update User Id")
    upd_dt: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=text("TIMEZONE('utc', CURRENT_TIMESTAMP)"),
        onupdate=text("TIMEZONE('utc', CURRENT_TIMESTAMP)"),
        comment="Update Date (UTC)",
    )
    lcl_upd_dt: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        comment="Local Update Date",
    )

class NxChatBotShrtCutV(Base):
    __table__ = Table(
        "nx_chat_bot_shrt_cut_v",
        Base.metadata,
        Column("ten_id", String, primary_key=True),
        Column("stg_id", String, primary_key=True),
        Column("id", String, primary_key=True),
        Column("name", String),
        Column("sub_categories", JSON),
        Column("sec_ofc_id", String, primary_key=True),
        info={'is_view': True},
    )

# 뷰 생성 쿼리
create_view = """
    DROP TABLE IF EXISTS nx_chat_bot_shrt_cut_v CASCADE;
    CREATE OR REPLACE VIEW nx_chat_bot_shrt_cut_v As 
    SELECT ncbsc1.ten_id 
    	 , ncbsc1.stg_id 
    	 , ncbsc1.shrt_cut_id as id 
    	 , ncbsc1.shrt_cut_nm as name 
    	 , ncbsc2.sub_ctgy_val as sub_categories 
    	 , ncbsc1.sec_ofc_id 
    FROM ( SELECT shrt_cut_id 
    			, shrt_cut_nm 
    			, shrt_cut_seq 
    			, ten_id 
    			, stg_id 
    			, sec_ofc_id 
           FROM   nx_chat_bot_shrt_cut 
           WHERE  par_shrt_cut_id IS null 
         ) ncbsc1 
    INNER JOIN ( SELECT ncbsc.par_shrt_cut_id 
    				  , json_agg(json_build_object( 'title', ncbsc.shrt_cut_nm 
    				  							  , 'items', ncbsci.items)  
    				  			 ORDER BY ncbsc.shrt_cut_seq) AS sub_ctgy_val 
                 FROM   nx_chat_bot_shrt_cut ncbsc 
                 INNER JOIN ( SELECT shrt_cut_id 
                 				   , json_agg(json_build_object( 'title', item_nm 
                 				   							   , 'description', item_des 
                 				   							   , 'action', shrt_evnt_act)  
                 				   			  ORDER BY item_seq) AS items 
                       		  FROM   nx_chat_bot_shrt_cut_item 
                      		  GROUP BY shrt_cut_id) ncbsci  
                      	 ON  ncbsci.shrt_cut_id = ncbsc.shrt_cut_id 
              	 WHERE  ncbsc.par_shrt_cut_id IS NOT NULL 
              	 GROUP BY ncbsc.par_shrt_cut_id 
               ) ncbsc2  
            ON ncbsc2.par_shrt_cut_id = ncbsc1.shrt_cut_id 
    ORDER BY ncbsc1.shrt_cut_seq 
"""

@event.listens_for(Table, "before_create")
def skip_view_tables(target, connection, **kw):
    # MetaData 내의 모든 테이블을 검사하여 info에 'is_view'가 있으면 생성 대상에서 제거
    if target.info.get('is_view'):
        # 실제 DB에 테이블 생성을 시도하지 않도록 'checkfirst'를 조작하거나
        # 이벤트를 통해 생성을 방지합니다.
        print(f"--- Skipping table creation for VIEW: {target.name} ---")
        return False

# shortcut 초기데이터 삽입
insert_shortcut_data = """
    INSERT INTO public.nx_chat_bot_shrt_cut (ten_id,stg_id,shrt_cut_id,usr_id,par_shrt_cut_id,shrt_cut_nm,shrt_cut_seq,cre_usr_id,cre_dt,lcl_cre_dt,upd_usr_id,upd_dt,lcl_upd_dt,sec_ofc_id) VALUES
        ('1000','DEV','1000_DEV_000025_1',NULL,NULL,'Process Execution',1,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.669223','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.66923','000025'),
        ('1000','DEV','1000_DEV_000025_2',NULL,'1000_DEV_000025_1','Customer Service',1,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.688971','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.688979','000025'),
        ('1000','DEV','1000_DEV_000025_3',NULL,'1000_DEV_000025_1','Logistics',2,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.68898','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.688981','000025'),
        ('1000','DEV','1000_DEV_000025_4',NULL,'1000_DEV_000025_1','General',3,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.688982','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.688982','000025'),
        ('1000','DEV','1000_DEV_000025_5',NULL,'1000_DEV_000025_1','Finance',4,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.688983','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.688984','000025'),
        ('1000','DEV','1000_DEV_000025_6',NULL,NULL,'Search',2,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.69501','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.695016','000025'),
        ('1000','DEV','1000_DEV_000025_7',NULL,'1000_DEV_000025_6','Question',1,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.699792','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.699796','000025'),
        ('1000','DEV','1000_DEV_000025_8',NULL,NULL,'Execution',3,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.704626','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.70463','000025'),
        ('1000','DEV','1000_DEV_000025_9',NULL,'1000_DEV_000025_8','Vessel Voyage Change',1,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.707774','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.707777','000025'),
        ('1000','DEV','1000_DEV_000025_10',NULL,'1000_DEV_000025_8','Tracking',2,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.707778','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.707779','000025'),
        ('1000','DEV','1000_DEV_000025_11',NULL,'1000_DEV_000025_8','Finance',3,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.70778','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.707781','000025');

    INSERT INTO nx_chat_bot_shrt_cut_item (ten_id,stg_id,item_id,shrt_cut_id,item_nm,item_des,shrt_evnt_act,item_seq,cre_usr_id,cre_dt,lcl_cre_dt,upd_usr_id,upd_dt,lcl_upd_dt,sec_ofc_id) VALUES
        ('1000','DEV','1','1000_DEV_000025_2','선박 변경','선박 변경','{"type": "scenario", "value": "선박 변경"}',1,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723832','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723838','000025'),
        ('1000','DEV','2','1000_DEV_000025_3','도착 일정 영향분석','도착 일정 영향분석','{"type": "scenario", "value": "도착일자 영향 분석"}',1,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723839','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.72384','000025'),
        ('1000','DEV','3','1000_DEV_000025_4','시나리오 목록','Scenario List','{"type": "custom", "value": "GET_SCENARIO_LIST"}',1,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723841','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723841','000025'),
        ('1000','DEV','4','1000_DEV_000025_5','Finance 영향도 확인','Finance 영향도 확인','{"type": "scenario", "value": "Finance 영향도 분석"}',1,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723842','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723843','000025'),
        ('1000','DEV','5','1000_DEV_000025_5','오류 메세지 테스트','오류 메세지 테스트','{"type": "scenario", "value": ""}',2,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723844','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723844','000025'),
        ('1000','DEV','6','1000_DEV_000025_7','Q1','BOOKING NO. AL0000184986 관련으로 KRPUSHN 에서 KRPUSYH 구간에 계약된 S/P(Service Provider) 업체 정보를 알 수 있을까요?','{"type": "text", "value": "BOOKING NO. AL0000184986 관련으로 KRPUSHN 에서 KRPUSYH 구간에 계약된 S/P(Service Provider) 업체 정보를 알 수 있을까요?"}',1,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723845','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723846','000025'),
        ('1000','DEV','7','1000_DEV_000025_7','Q2','Terminal Shuttle 비용을 B/L Charge에 입력하는 방법을 알려주세요.','{"type": "text", "value": "Terminal Shuttle 비용을 B/L Charge에 입력하는 방법을 알려주세요."}',2,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723846','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723847','000025'),
        ('1000','DEV','8','1000_DEV_000025_7','Q3','Shuttle 비용을 MISCELLANEOUS SURCHARGE 로 처리하려고 합니다. 적절한 Charge Code 를 알려주세요.','{"type": "text", "value": "Shuttle 비용을 MISCELLANEOUS SURCHARGE 로 처리하려고 합니다. 적절한 Charge Code 를 알려주세요."}',3,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723848','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723848','000025'),
        ('1000','DEV','9','1000_DEV_000025_7','Q4 [분석]','현 시점 기준으로 "SELSC" Office의 화주별 USD 기준 미수금(Outstanding) Top 5 그래프를 보여줘','{"type": "text", "value": "현 시점 기준으로 \\"SELSC\\" Office의 화주별 USD 기준 미수금(Outstanding) Top 5 그래프를 보여줘"}',4,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723849','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.72385','000025'),
        ('1000','DEV','10','1000_DEV_000025_7','Q5 [분석]','Fairway Transport CO.. LTD 화주의 연체 기간별 미수금 분포 현황을 분석해서 알려줄래?','{"type": "text", "value": "Fairway Transport CO.. LTD 화주의 연체 기간별 미수금 분포 현황을 분석해서 알려줄래?"}',5,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.72385','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723851','000025'),
        ('1000','DEV','11','1000_DEV_000025_7','Q6 [화면]','T-code 1102 화면 알려줘','{"type": "text", "value": "T-code 1102 화면 알려줘"}',6,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723852','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723852','000025'),
        ('1000','DEV','12','1000_DEV_000025_7','Q7 [메뉴얼 + 화면]','Full Job Order와 Other Job Order의 차이와 Full Job Order 화면도 같이 설명해줘','{"type": "text", "value": "Full Job Order와 Other Job Order의 차이와 Full Job Order 화면도 같이 설명해줘"}',7,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723853','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723854','000025'),
        ('1000','DEV','13','1000_DEV_000025_7','Q8 [e-SOP]','부킹 생성 프로세스의 e-SOP 흐름 정보를 알려주세요.','{"type": "text", "value": "부킹 생성 프로세스의 e-SOP 흐름 정보를 알려주세요."}',8,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723854','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723855','000025'),
        ('1000','DEV','14','1000_DEV_000025_9','Scenario #1-1','선박 변경 안되는 케이스 Validation (출항 후(VL))','{"type": "scenario", "value": "선박 변경 안되는 케이스 Validation (출항 후(VL))"}',1,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723856','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723856','000025'),
        ('1000','DEV','15','1000_DEV_000025_9','Scenario #1-2','대화흐름 방식 + J/O 단건 (B/L Charge)','{"type": "scenario", "value": "T대화흐름 방식 + J/O 단건 (B/L Charge)"}',2,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723857','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723858','000025'),
        ('1000','DEV','16','1000_DEV_000025_9','Scenario #1-3','단일흐름 방식 + J/O 단건 (TPL Creation)','{"type": "scenario", "value": "단일흐름 방식 | JO 단건 (TPL Creation)"}',3,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723859','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.72386','000025'),
        ('1000','DEV','17','1000_DEV_000025_9','Scenario #1-4','단일흐름 방식 + J/O 다건(RPA) (B/L Charge)','{"type": "scenario", "value": "단일흐름 방식 | JO 다건(RPA) (BL Charge)"}',4,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.72386','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723861','000025'),
        ('1000','DEV','18','1000_DEV_000025_10','Scenario #2','도착일자 영향 분석','{"type": "scenario", "value": "도착일자 영향 분석"}',1,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723862','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723863','000025'),
        ('1000','DEV','19','1000_DEV_000025_11','Scenario #3','Finance 영향도 분석','{"type": "scenario", "value": "Finance 영향도 분석"}',1,'NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723863','NX_ADMIN','2026-01-23 07:24:29.489539','2026-01-23 07:24:29.723864','000025');
"""
