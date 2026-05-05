import { useEffect, useState } from 'react'
import { Alert, Button, Form, Modal, Select, Space, Table, Upload } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { DBArticle, SentenceFormData } from '../types/index'

interface ParsedRow {
  content: string
  translate: string
}

interface Props {
  open: boolean
  articles: DBArticle[]
  initialArticleId?: string
  onOk: (rows: SentenceFormData[]) => Promise<void>
  onCancel: () => void
}

function parseTxt(text: string): ParsedRow[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = normalized.trim().split(/\n[ \t]*\n/)
  return blocks
    .map(block => {
      const lines = block.trim().split('\n')
      return {
        content: lines[0]?.trim() ?? '',
        translate: lines[1]?.trim() ?? '',
      }
    })
    .filter(row => row.content)
}

export default function BatchUploadModal({ open, articles, initialArticleId, onOk, onCancel }: Props) {
  const [articleId, setArticleId] = useState<string | undefined>(initialArticleId)

  useEffect(() => {
    if (open) setArticleId(initialArticleId)
  }, [open, initialArticleId])
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const parsed = parseTxt(text)
      if (parsed.length === 0) {
        setParseError('未解析到有效句子，请检查文件格式')
        setRows([])
      } else {
        setParseError('')
        setRows(parsed)
      }
    }
    reader.readAsText(file, 'utf-8')
    return false // 阻止 antd Upload 自动上传
  }

  const handleOk = async () => {
    if (!articleId) return
    if (rows.length === 0) return
    setSubmitting(true)
    await onOk(rows.map(r => ({ content: r.content, translate: r.translate, articleId })))
    setSubmitting(false)
    setRows([])
    setArticleId(undefined)
  }

  const handleCancel = () => {
    setRows([])
    setArticleId(undefined)
    setParseError('')
    onCancel()
  }

  const columns = [
    { title: '句子内容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '中文翻译', dataIndex: 'translate', key: 'translate', ellipsis: true, width: 200 },
  ]

  return (
    <Modal
      title="批量上传句子"
      open={open}
      onCancel={handleCancel}
      width={700}
      footer={
        <Space>
          <Button onClick={handleCancel}>取消</Button>
          <Button
            type="primary"
            disabled={!articleId || rows.length === 0}
            loading={submitting}
            onClick={handleOk}
          >
            上传 {rows.length > 0 ? `(${rows.length} 条)` : ''}
          </Button>
        </Space>
      }
      destroyOnHidden
    >
      <Form layout="vertical">
        <Form.Item label="所属文章" required>
          <Select
            placeholder="选择文章"
            style={{ width: '100%' }}
            options={articles.map(a => ({ label: a.title, value: a.id }))}
            showSearch
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            value={articleId}
            onChange={setArticleId}
          />
        </Form.Item>

        <Form.Item
          label="上传 txt 文件"
          extra="格式：句子内容（第1行）+ 翻译（第2行）+ 空行分隔"
        >
          <Upload.Dragger
            accept=".txt"
            beforeUpload={handleFile}
            showUploadList={false}
            maxCount={1}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽 txt 文件到此区域</p>
            <p className="ant-upload-hint">
              每条句子占两行：第1行内容，第2行翻译，句子之间用空行分隔
            </p>
          </Upload.Dragger>
        </Form.Item>

        {parseError && <Alert type="error" message={parseError} style={{ marginBottom: 12 }} />}

        {rows.length > 0 && (
          <Form.Item label={`预览（共 ${rows.length} 条）`}>
            <Table
              size="small"
              columns={columns}
              dataSource={rows.map((r, i) => ({ ...r, key: i }))}
              pagination={{ pageSize: 5, size: 'small' }}
              scroll={{ y: 200 }}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
