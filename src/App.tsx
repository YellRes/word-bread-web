import { useEffect, useState } from 'react'
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { PlusOutlined, UploadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import SentenceModal from './components/SentenceModal'
import BatchUploadModal from './components/BatchUploadModal'
import { createArticle, deleteArticle, fetchArticles } from './services/articleService'
import {
  batchCreateSentences,
  createSentence,
  deleteSentence,
  fetchSentences,
  updateSentence,
} from './services/sentenceService'
import type { DBArticle, DBSentence, SentenceFormData } from './types/index'

const { Title } = Typography

function renderContent(text: string) {
  const parts = text.split(/(\([^)]+\))/g)
  return (
    <span>
      {parts.map((part, i) =>
        /^\([^)]+\)$/.test(part) ? (
          <Tag color="orange" key={i} style={{ margin: '0 2px' }}>
            {part.slice(1, -1)}
          </Tag>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

export default function App() {
  const [articles, setArticles] = useState<DBArticle[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [sentencesByArticle, setSentencesByArticle] = useState<Record<string, DBSentence[]>>({})
  const [loadingArticles, setLoadingArticles] = useState<Set<string>>(new Set())
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([])

  // sentence modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DBSentence | null>(null)
  const [nextArticleId, setNextArticleId] = useState<string | undefined>()
  const [modalKey, setModalKey] = useState(0)

  // batch upload modal
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchArticleId, setBatchArticleId] = useState<string | undefined>()

  // article modal
  const [articleModalOpen, setArticleModalOpen] = useState(false)
  const [articleForm] = Form.useForm<{ title: string }>()

  const loadArticles = async () => {
    setArticlesLoading(true)
    const data = await fetchArticles()
    setArticles(data)
    setArticlesLoading(false)
  }

  const loadSentencesForArticle = async (articleId: string) => {
    setLoadingArticles(prev => new Set(prev).add(articleId))
    const data = await fetchSentences({ articleId })
    setSentencesByArticle(prev => ({ ...prev, [articleId]: data }))
    setLoadingArticles(prev => { const s = new Set(prev); s.delete(articleId); return s })
  }

  const refreshArticleSentences = (articleId: string) => loadSentencesForArticle(articleId)

  useEffect(() => { loadArticles() }, [])

  const handleExpand = (expanded: boolean, record: DBArticle) => {
    if (expanded) {
      setExpandedRowKeys(prev => [...prev, record.id])
      if (!sentencesByArticle[record.id]) loadSentencesForArticle(record.id)
    } else {
      setExpandedRowKeys(prev => prev.filter(k => k !== record.id))
    }
  }

  const handleSentenceModalOk = async (data: SentenceFormData, keepOpen = false) => {
    let ok: boolean
    if (editing) {
      ok = await updateSentence(editing.id, data)
    } else {
      ok = await createSentence(data)
    }
    if (ok) {
      message.success(editing ? '更新成功' : '创建成功')
      refreshArticleSentences(data.articleId)
      if (keepOpen) {
        setNextArticleId(data.articleId)
        setModalKey(k => k + 1)
      } else {
        setModalOpen(false)
        setEditing(null)
        setNextArticleId(undefined)
      }
    } else {
      message.error('操作失败，请重试')
    }
  }

  const handleDeleteSentence = async (sentence: DBSentence) => {
    const ok = await deleteSentence(sentence.id)
    if (ok) {
      message.success('删除成功')
      refreshArticleSentences(sentence.articleId)
    } else {
      message.error('删除失败')
    }
  }

  const sentenceColumns: ColumnsType<DBSentence> = [
    {
      title: '句子内容',
      dataIndex: 'content',
      key: 'content',
      render: (text: string) => renderContent(text),
    },
    {
      title: '中文翻译',
      dataIndex: 'translate',
      key: 'translate',
      ellipsis: true,
      width: 220,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => { setEditing(record); setNextArticleId(record.articleId); setModalOpen(true) }}>
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteSentence(record)} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const articleColumns: ColumnsType<DBArticle> = [
    {
      title: '文章标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_, record) => (
        <Space>
          <Button
            type="link" size="small"
            onClick={() => { setEditing(null); setNextArticleId(record.id); setModalKey(k => k + 1); setModalOpen(true) }}
          >
            新建句子
          </Button>
          <Button
            type="link" size="small" icon={<UploadOutlined />}
            onClick={() => { setBatchArticleId(record.id); setBatchOpen(true) }}
          >
            批量上传
          </Button>
          <Popconfirm title={`确认删除「${record.title}」？`} okText="删除" cancelText="取消" onConfirm={async () => {
            const ok = await deleteArticle(record.id)
            if (ok) { message.success('删除成功'); loadArticles() }
            else message.error('删除失败')
          }}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={3} style={{ marginBottom: 24 }}>句子管理</Title>

      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<PlusOutlined />} onClick={() => { articleForm.resetFields(); setArticleModalOpen(true) }}>
          新建文章
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setNextArticleId(undefined); setModalKey(k => k + 1); setModalOpen(true) }}>
          新建句子
        </Button>
        <Button icon={<UploadOutlined />} onClick={() => { setBatchArticleId(undefined); setBatchOpen(true) }}>
          批量上传
        </Button>
      </Space>

      <Table
        rowKey="id"
        columns={articleColumns}
        dataSource={articles}
        loading={articlesLoading}
        pagination={{ pageSize: 20, showTotal: total => `共 ${total} 篇文章` }}
        expandable={{
          expandedRowKeys,
          onExpand: handleExpand,
          expandedRowRender: (record) => (
            <Table
              size="small"
              rowKey="id"
              columns={sentenceColumns}
              dataSource={sentencesByArticle[record.id] || []}
              loading={loadingArticles.has(record.id)}
              pagination={false}
              style={{ margin: '0 8px' }}
            />
          ),
        }}
      />

      <BatchUploadModal
        open={batchOpen}
        articles={articles}
        initialArticleId={batchArticleId}
        onOk={async (rows) => {
          const { count, error } = await batchCreateSentences(rows)
          if (error) {
            message.error(`上传失败：${error}`)
          } else {
            message.success(`成功上传 ${count} 条句子`)
            setBatchOpen(false)
            if (rows[0]?.articleId) refreshArticleSentences(rows[0].articleId)
          }
        }}
        onCancel={() => setBatchOpen(false)}
      />

      <Modal
        title="新建文章"
        open={articleModalOpen}
        onCancel={() => setArticleModalOpen(false)}
        onOk={async () => {
          const { title } = await articleForm.validateFields()
          const ok = await createArticle(title.trim())
          if (ok) { message.success('文章创建成功'); setArticleModalOpen(false); loadArticles() }
          else message.error('创建失败，请重试')
        }}
        okText="创建"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={articleForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="文章标题" rules={[{ required: true, message: '请输入文章标题' }]}>
            <Input placeholder="输入文章标题" />
          </Form.Item>
        </Form>
      </Modal>

      <SentenceModal
        key={modalKey}
        open={modalOpen}
        sentence={editing}
        initialArticleId={nextArticleId}
        articles={articles}
        onOk={handleSentenceModalOk}
        onCancel={() => { setModalOpen(false); setEditing(null); setNextArticleId(undefined) }}
      />
    </div>
  )
}
