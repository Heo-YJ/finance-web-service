import type { SimulationAssumptions } from './types'

const VERIFIED_AS_OF = '2026-09-23'

const ISA_LAW_SOURCE =
  'https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1031850453'
const ISA_TAX_SOURCE = 'https://www.kbsec.com/go.able?linkcd=m05080009'
const ISA_CONTRIBUTION_SOURCE =
  'https://whatsnew.moef.go.kr/mec/ots/dif/view.do?comBaseCd=DIFGODEPRT&difGovDepart1=DIFGODR001&difSer=c514effc-c831-4eb1-94c7-6eab084dcac8&temp=2021&temp2=HALF001'

export const DEFAULT_ASSUMPTIONS: SimulationAssumptions = {
  simulationMonths: 36,
  emergencyFundMonths: 3,
  riskAnnualRates: {
    stable: {
      value: 0.02,
      label: '안정형 가정 수익률',
      category: 'educational',
      asOf: VERIFIED_AS_OF,
      sourceUrl: null,
      note: '특정 상품의 예상 수익률이 아닌 교육용 시나리오입니다.',
    },
    balanced: {
      value: 0.05,
      label: '중립형 가정 수익률',
      category: 'educational',
      asOf: VERIFIED_AS_OF,
      sourceUrl: null,
      note: '특정 상품의 예상 수익률이 아닌 교육용 시나리오입니다.',
    },
    aggressive: {
      value: 0.08,
      label: '적극형 가정 수익률',
      category: 'educational',
      asOf: VERIFIED_AS_OF,
      sourceUrl: null,
      note: '특정 상품의 예상 수익률이 아닌 교육용 시나리오입니다.',
    },
  },
  cmaAnnualRate: {
    value: 0.025,
    label: 'CMA 교육용 가정 수익률',
    category: 'educational',
    asOf: VERIFIED_AS_OF,
    sourceUrl: null,
    note: '특정 CMA 상품의 금리를 나타내지 않으며 화면에서 가정임을 밝힙니다.',
  },
  normalTaxRate: {
    value: 0.154,
    label: '일반계좌 과세 대상 수익 세율 가정',
    category: 'legal',
    asOf: VERIFIED_AS_OF,
    sourceUrl: ISA_TAX_SOURCE,
    note: '동일한 과세 대상 이자·배당 성격의 수익을 비교하기 위한 지방소득세 포함 가정입니다.',
  },
  isaTaxRate: {
    value: 0.099,
    label: 'ISA 비과세 한도 초과분 분리과세율',
    category: 'legal',
    asOf: VERIFIED_AS_OF,
    sourceUrl: ISA_TAX_SOURCE,
    note: '지방소득세를 포함한 세율입니다.',
  },
  isaTaxFreeLimits: {
    general: {
      value: 2_000_000,
      label: '일반형 ISA 비과세 한도',
      category: 'legal',
      asOf: VERIFIED_AS_OF,
      sourceUrl: ISA_LAW_SOURCE,
      note: 'ISA 순수익 기준 비과세 한도입니다.',
    },
    lowIncome: {
      value: 4_000_000,
      label: '서민형 ISA 비과세 한도',
      category: 'legal',
      asOf: VERIFIED_AS_OF,
      sourceUrl: ISA_LAW_SOURCE,
      note: '가입 자격을 충족한 사용자의 ISA 순수익 기준 비과세 한도입니다.',
    },
  },
  isaAnnualContributionLimit: {
    value: 20_000_000,
    label: 'ISA 기본 연간 납입한도',
    category: 'legal',
    asOf: VERIFIED_AS_OF,
    sourceUrl: ISA_CONTRIBUTION_SOURCE,
    note: '미사용 한도 이월과 실제 계좌의 잔여 한도는 별도로 확인해야 합니다.',
  },
}
