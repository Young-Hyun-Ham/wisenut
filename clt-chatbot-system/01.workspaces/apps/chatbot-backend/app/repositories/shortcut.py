from __future__ import annotations

from typing import List, Optional
from uuid import uuid4

from sqlalchemy import insert, delete
from sqlalchemy.orm import Session

from app.db.models import NxChatBotShrtCut, NxChatBotShrtCutItem, NxChatBotShrtCutV
from app.schemas import Shortcut

class ShortRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> list[NxChatBotShrtCutV] | None:
        return self.db.query(NxChatBotShrtCutV).all()
    
    def delete(self):
        self.db.execute(
            delete(NxChatBotShrtCut).where(
                NxChatBotShrtCut.ten_id=='1000',
                NxChatBotShrtCut.stg_id=='DEV',
                NxChatBotShrtCut.sec_ofc_id=='000025',
            )
        )

        self.db.execute(
            delete(NxChatBotShrtCutItem).where(
                NxChatBotShrtCutItem.ten_id=='1000',
                NxChatBotShrtCutItem.stg_id=='DEV',
                NxChatBotShrtCutItem.sec_ofc_id=='000025',
            )
        )

        self.db.commit()

    def save(self, data_list: list[Shortcut]):

        ten_id = '1000'
        stg_id = 'DEV'
        sec_ofc_id = '000025'
        usr_id = 'SYSTEM'

        # 기존 shortcut 삭제
        self.delete()

        # 데이터 정제 후 저장
        short_cut_list = []
        short_cut_item_list = []

        seq = 1
        short_cut_key = 1
        short_cut_item_key = 1

        for data in data_list:
            # 2-1. 최상위 숏컷 등록
            short_cut_data = {}
            short_cut_data["ten_id"] = ten_id
            short_cut_data["stg_id"] = stg_id
            short_cut_data["sec_ofc_id"] = sec_ofc_id
            short_cut_data["par_shrt_cut_id"] = None
            short_cut_data["shrt_cut_id"] = (
                f"{ten_id}_{stg_id}_{sec_ofc_id}_{short_cut_key}"
            )
            short_cut_data["shrt_cut_nm"] = data.name
            short_cut_data["shrt_cut_seq"] = seq
            short_cut_data["cre_usr_id"] = usr_id
            short_cut_data["upd_usr_id"] = usr_id
            seq += 1
            short_cut_key += 1

            short_cut_list.append(short_cut_data)

            sub_seq = 1
            for sub_data in data.subCategories:
                # 2-2. 하위 숏컷 등록
                sub_short_cut_data = {}
                sub_short_cut_data["ten_id"] = ten_id
                sub_short_cut_data["stg_id"] = stg_id
                sub_short_cut_data["sec_ofc_id"] = sec_ofc_id
                sub_short_cut_data["par_shrt_cut_id"] = short_cut_data["shrt_cut_id"]
                sub_short_cut_data["shrt_cut_id"] = (
                    f"{ten_id}_{stg_id}_{sec_ofc_id}_{short_cut_key}"
                )
                sub_short_cut_data["shrt_cut_nm"] = sub_data.title
                sub_short_cut_data["shrt_cut_seq"] = sub_seq
                sub_short_cut_data["cre_usr_id"] = usr_id
                sub_short_cut_data["upd_usr_id"] = usr_id
                sub_seq += 1
                short_cut_key += 1

                short_cut_list.append(sub_short_cut_data)

                item_seq = 1
                for item in sub_data.items:
                    # 2-3. 숏컷 아이템 등록
                    item_data = {}
                    item_data["ten_id"] = ten_id
                    item_data["stg_id"] = stg_id
                    item_data["sec_ofc_id"] = sec_ofc_id
                    item_data["shrt_cut_id"] = sub_short_cut_data["shrt_cut_id"]
                    item_data["item_id"] = short_cut_item_key
                    item_data["item_nm"] = item.title
                    item_data["item_des"] = item.description
                    item_data["shrt_evnt_act"] = item.action.model_dump()
                    item_data["item_seq"] = item_seq
                    item_data["cre_usr_id"] = usr_id
                    item_data["upd_usr_id"] = usr_id
                    item_seq += 1
                    short_cut_item_key += 1

                    short_cut_item_list.append(item_data)

        self.db.execute(insert(NxChatBotShrtCut), short_cut_list)
        self.db.execute(insert(NxChatBotShrtCutItem), short_cut_item_list)
        self.db.commit()