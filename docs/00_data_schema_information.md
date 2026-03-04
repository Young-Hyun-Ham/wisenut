
# DB 스키마 정보
## nx_chat_bot_snro_info (챗봇 시나리오 정보 관리 테이블)
  컬럼명,데이터 타입,Null 허용,기본값,비고 (Comment)
  ten_id,varchar(10),N,,Tenant ID
  stg_id,varchar(10),N,,Stage ID
  snro_id,varchar(50),N,,Scenario ID
  snro_nm,varchar(100),N,,Scenario Name
  snro_des,varchar(2000),Y,,Scenario Description
  nde_set_val_meta,jsonb,Y,,Node Set Value(Nodes)
  eg_set_val_meta,jsonb,Y,,Edge Set Value(Edges)
  st_nde_id,varchar(50),Y,,Start Node Id
  cre_usr_id,varchar(20),Y,,Create User Id
  cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Create Date
  lcl_cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Create Date
  upd_usr_id,varchar(20),Y,,Update User Id
  upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Update Date
  lcl_upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Update Date
  sec_ofc_id,varchar(6),N,,Security Office Id
  del_yn,varchar(1),Y,'N'::character varying,삭제 여부

## nx_chat_bot_snro_msg(챗봇 시나리오 메시지 이력 관리 테이블)
  컬럼명,데이터 타입,Null 허용,기본값,비고 (Comment)
  ten_id,varchar(10),N,,Tenant ID
  stg_id,varchar(10),N,,Stage ID
  snro_sess_id,varchar(36),N,,Scenario Session Id
  snro_msg_seq,int4,N,,Sequence
  usr_id,varchar(20),N,,User ID
  curt_nde_id,varchar(100),Y,,Current Node Id
  snro_msg_meta,jsonb,Y,,Message
  slot_val_meta,jsonb,Y,,Slot Value
  sts_val_meta,jsonb,Y,,Status Value
  cre_usr_id,varchar(20),Y,,Create User Id
  cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Create Date
  lcl_cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Create Date
  upd_usr_id,varchar(20),Y,,Update User Id
  upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Update Date
  lcl_upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Update Create Date
  sec_ofc_id,varchar(6),N,,Security Office Id
  del_yn,varchar(1),Y,'N'::character varying,삭제 여부

## nx_chat_bot_snro_sess(챗봇 시나리오 세션 정보 관리 테이블)
  컬럼명,데이터 타입,Null 허용,기본값,비고 (Comment)
  ten_id,varchar(10),N,,Tenant ID
  stg_id,varchar(10),N,,Stage ID
  sess_id,varchar(36),N,,ID (Session ID)
  conv_id,varchar(36),N,,Conversation ID
  usr_id,varchar(20),N,,User ID
  snro_id,varchar(50),Y,,Scenario ID
  sts_val,"public.""sts_tp""",Y,,Status Value
  cre_usr_id,varchar(20),Y,,Create User Id
  cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Create Date
  lcl_cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Create Date
  upd_usr_id,varchar(20),Y,,Update User Id
  upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Update Date
  lcl_upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Update Date
  sec_ofc_id,varchar(6),N,,Security Office Id
  del_yn,varchar(1),Y,'N'::character varying,삭제 여부
  
## nx_chat_bot_shrt_cut_item(챗봇 숏컷 세부항목 정보)
  컬럼명,데이터 타입,Null 허용,기본값,비고 (Comment)
  ten_id,varchar(10),N,,Tenant ID
  stg_id,varchar(10),N,,Stage ID
  item_id,serial4,N,nextval('..._seq'::regclass),Item ID (자동 증가 고유 키)
  shrt_cut_id,varchar(50),Y,,Short Cut ID
  item_nm,varchar(100),Y,,Item Name
  item_des,varchar(2000),Y,,Item Description
  shrt_evnt_act_meta,jsonb,Y,,Short Event Act Meta
  item_seq,int4,Y,,Item Sequence
  cre_usr_id,varchar(20),Y,,Create User Id
  cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Create Date
  lcl_cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Create Date
  upd_usr_id,varchar(20),Y,,Update User Id
  upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Update Date
  lcl_upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Update Date
  sec_ofc_id,varchar(6),N,,Security Office Id
  del_yn,varchar(1),Y,'N'::character varying,삭제 여부

## nx_chat_bot_shrt_cut(챗봇 숏컷 정보)
  컬럼명,데이터 타입,Null 허용,기본값,비고 (Comment)
  ten_id,varchar(10),N,,Tenant ID
  stg_id,varchar(10),N,,Stage ID
  shrt_cut_id,varchar(50),N,,ShortCut ID
  usr_id,varchar(20),Y,,User ID
  par_shrt_cut_id,varchar(50),Y,,Parent Shortcut Id
  shrt_cut_nm,varchar(100),Y,,ShortCut Name
  shrt_cut_seq,int4,Y,,ShortCut Sequence
  cre_usr_id,varchar(20),Y,,Create User Id
  cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Create Date
  lcl_cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Create Date
  upd_usr_id,varchar(20),Y,,Update User Id
  upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Update Date
  lcl_upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Update Date
  sec_ofc_id,varchar(6),N,,Security Office Id
  del_yn,varchar(1),Y,'N'::character varying,삭제 여부

## nx_chat_bot_prim_set(챗봇 개인설정 정보)
  컬럼명,데이터 타입,Null 허용,기본값,비고 (Comment)
  ten_id,varchar(10),N,,Tenant ID
  stg_id,varchar(10),N,,Stage ID
  usr_id,varchar(20),N,,User ID
  cntn_sum_lmt_ct,int4,Y,12,Content Summary Limit Count
  df_font_size_val,int4,Y,16,Font Size Value
  dvlp_mode_yn,varchar(1),Y,'N'::character varying,Develop Mode Yn
  lang_cd,varchar(2),Y,'en'::character varying,Language Code
  theme_nm,"public.""theme_tp""",Y,,Theme Name
  cre_usr_id,varchar(20),Y,,Create User Id
  cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Create Date
  lcl_cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Create Date
  upd_usr_id,varchar(20),Y,,Update User Id
  upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Update Date
  lcl_upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Update Date
  sec_ofc_id,varchar(6),N,,Security Office Id
  del_yn,varchar(1),Y,'N'::character varying,삭제 여부

## nx_chat_bot_conv_msg(챗봇 대화 메시지 정보)
  컬럼명,데이터 타입,Null 허용,기본값,비고 (Comment)
  ten_id,varchar(10),N,,Tenant ID
  stg_id,varchar(10),N,,Stage ID
  msg_id,varchar(36),N,,Message ID
  conv_id,varchar(36),N,,Conversation ID
  usr_id,varchar(20),N,,User ID
  msg_cntn,text,Y,,Content (메시지 본문)
  msg_sndr,varchar(10),Y,,Sender (발신자)
  msg_fdbk,varchar(1),Y,,Feedback (좋아요/싫어요 등)
  stre_yn,varchar(1),Y,,STREAM YN (스트리밍 응답 여부)
  rich_cntn_yn,varchar(1),Y,,Rich Content Yn
  cht_data_val,varchar(1),Y,,Chart Data Value
  tp_nm,"public.""bubble_tp""",Y,,Bubble Type Name (말풍선 타입)
  snro_sess_id,varchar(36),Y,,Scenario Session ID
  cre_usr_id,varchar(20),Y,,Create User Id
  cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Create Date
  lcl_cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Create Date
  upd_usr_id,varchar(20),Y,,Update User Id
  upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Update Date
  lcl_upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Update Date
  sec_ofc_id,varchar(6),N,,Security Office Id
  del_yn,varchar(1),Y,'N'::character varying,삭제 여부

## nx_chat_bot_conv(챗봇 대화정보)
  컬럼명,데이터 타입,Null 허용,기본값,비고 (Comment)
  ten_id,varchar(10),N,,Tenant ID
  stg_id,varchar(10),N,,Stage ID
  conv_id,varchar(36),N,,ID (Conversation ID)
  usr_id,varchar(20),N,,User ID
  conv_nm,text,Y,,Conversation Name (대화 제목)
  pin_yn,varchar(1),Y,'N'::character varying,Pin Yn (즐겨찾기/고정 여부)
  cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Create Date
  lcl_cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Create Date
  upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Update Date
  lcl_upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Update Date
  sec_ofc_id,varchar(6),N,,Security Office Id
  del_yn,varchar(1),Y,'N'::character varying,삭제 여부

## nx_chat_bot_com_cfg(챗봇 일반 설정 정보)
  컬럼명,데이터 타입,Null 허용,기본값,비고 (Comment)
  ten_id,varchar(10),N,,Tenant ID
  stg_id,varchar(10),N,,Stage ID
  hdr_nm,varchar(50),N,,Header Name (챗봇 상단 타이틀)
  inpt_gde_msg,varchar(2000),Y,,Input Guide Message (입력창 가이드 문구)
  enbl_mark_down_yn,varchar(1),Y,'Y'::character varying,Enable Markdown YN (마크다운 활성화 여부)
  cre_usr_id,varchar(20),Y,,Create User Id
  cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Create Date
  lcl_cre_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Create Date
  upd_usr_id,varchar(20),Y,,Update User Id
  upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Update Date
  lcl_upd_dt,timestamp,Y,CURRENT_TIMESTAMP,Local Update Date
  sec_ofc_id,varchar(6),N,,Security Office Id
  del_yn,varchar(1),Y,'N'::character varying,삭제 여부