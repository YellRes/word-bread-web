import { useEffect } from 'react'
import { Button, Form, Input, Modal, Select, Space } from 'antd'
import type { DBArticle, DBSentence, SentenceFormData } from '../types/index'

interface Props {
  open: boolean
  sentence?: DBSentence | null
  initialArticleId?: string
  articles: DBArticle[]
  onOk: (data: SentenceFormData, keepOpen?: boolean) => void
  onCancel: () => void
}

export default function SentenceModal({ open, sentence, initialArticleId, articles, onOk, onCancel }: Props) {
  const [form] = Form.useForm<SentenceFormData>()
  const isEditing = !!sentence

  useEffect(() => {
    if (open) {
      form.setFieldsValue(
        sentence
          ? { content: sentence.content, articleId: sentence.articleId, translate: sentence.translate }
          : { content: '', articleId: initialArticleId, translate: '' }
      )
    }
  }, [open, sentence, initialArticleId, form])

  const handleOk = async (keepOpen = false) => {
    const values = await form.validateFields()
    onOk(values, keepOpen)
  }

  const footer = (
    <Space>
      <Button onClick={onCancel}>取消</Button>
      {!isEditing && (
        <Button onClick={() => handleOk(true)}>创建下一个</Button>
      )}
      <Button type="primary" onClick={() => handleOk(false)}>保存</Button>
    </Space>
  )

  return (
    <Modal
      title={isEditing ? '编辑句子' : '新建句子'}
      open={open}
      onCancel={onCancel}
      footer={footer}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="articleId"
          label="所属文章"
          rules={[{ required: true, message: '请选择文章' }]}
        >
          <Select
            placeholder="选择文章"
            options={articles.map(a => ({ label: a.title, value: a.id }))}
            showSearch
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            disabled={isEditing}
          />
        </Form.Item>
        <Form.Item
          name="content"
          label="句子内容"
          extra="括号格式：I have a (pen-笔)"
          rules={[{ required: true, message: '请输入句子内容' }]}
        >
          <Input.TextArea rows={3} placeholder="I have a (pen-笔)" />
        </Form.Item>
        <Form.Item name="translate" label="中文翻译">
          <Input.TextArea rows={2} placeholder="我有一支笔" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
