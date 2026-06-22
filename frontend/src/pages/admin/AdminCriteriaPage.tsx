import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  message,
} from 'antd';
import { useEffect, useState } from 'react';

import * as adminApi from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { Category, CriterionPayload, ScoringCriterion } from '../../types/domain';

const blankCriterion: CriterionPayload = {
  category_id: '',
  name: '',
  description: '',
  max_score: 10,
  display_order: 0,
  is_active: true,
};

export function AdminCriteriaPage() {
  const { token } = useAuth();
  const [form] = Form.useForm<CriterionPayload>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [criteria, setCriteria] = useState<ScoringCriterion[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<ScoringCriterion | null>(null);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  async function loadCategories() {
    if (!token) {
      return;
    }
    try {
      const nextCategories = await adminApi.getAdminCategories(token);
      setCategories(nextCategories);
      setSelectedCategoryId((current) => current ?? nextCategories[0]?.id);
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to load categories.');
    }
  }

  async function loadCriteria(categoryId?: string) {
    if (!token || !categoryId) {
      setCriteria([]);
      return;
    }
    setLoading(true);
    try {
      setCriteria(await adminApi.getAdminCriteria(token, categoryId));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to load criteria.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, [token]);

  useEffect(() => {
    void loadCriteria(selectedCategoryId);
  }, [token, selectedCategoryId]);

  function openCreateModal() {
    setEditingCriterion(null);
    form.setFieldsValue({ ...blankCriterion, category_id: selectedCategoryId ?? '' });
    setModalOpen(true);
  }

  function openEditModal(criterion: ScoringCriterion) {
    setEditingCriterion(criterion);
    form.setFieldsValue({
      category_id: criterion.category_id,
      name: criterion.name,
      description: criterion.description,
      max_score: criterion.max_score,
      display_order: criterion.display_order,
      is_active: criterion.is_active,
    });
    setModalOpen(true);
  }

  async function handleSubmit(values: CriterionPayload) {
    if (!token) {
      return;
    }

    setSaving(true);
    try {
      if (editingCriterion) {
        await adminApi.updateCriterion(token, editingCriterion.id, values);
      } else {
        await adminApi.createCriterion(token, values);
      }
      setModalOpen(false);
      await loadCriteria(selectedCategoryId);
      messageApi.success(`Criterion ${editingCriterion ? 'updated' : 'created'} successfully.`);
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to save criterion.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) {
      return;
    }
    try {
      await adminApi.deleteCriterion(token, id);
      await loadCriteria(selectedCategoryId);
      messageApi.success('Criterion deactivated.');
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to deactivate criterion.');
    }
  }

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <section className="page-hero">
          <Typography.Title className="page-title" level={1}>
            Criteria Management
          </Typography.Title>
          <Typography.Paragraph className="page-subtitle">
            Configure scoring topics, maximum points, rubric descriptions, and display order per award
            category.
          </Typography.Paragraph>
        </section>

        <Card className="soft-card">
          <div className="table-toolbar">
            <div className="table-toolbar__filters">
              <Select
                value={selectedCategoryId}
                onChange={(value) => setSelectedCategoryId(value)}
                options={categories.map((category) => ({ value: category.id, label: category.name }))}
                placeholder="Select category"
                style={{ width: 280 }}
              />
            </div>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              New Criterion
            </Button>
          </div>

          <Table<ScoringCriterion>
            rowKey="id"
            loading={loading}
            dataSource={criteria}
            pagination={false}
            columns={[
              { title: 'Name', dataIndex: 'name' },
              {
                title: 'Description',
                dataIndex: 'description',
                render: (value: string) =>
                  value ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{value}</span>
                  ) : (
                    <Typography.Text type="secondary">No description</Typography.Text>
                  ),
              },
              { title: 'Max Score', dataIndex: 'max_score', width: 120 },
              { title: 'Display Order', dataIndex: 'display_order', width: 140 },
              {
                title: 'Status',
                dataIndex: 'is_active',
                width: 120,
                render: (value: boolean) =>
                  value ? <Typography.Text style={{ color: '#4f7a57' }}>Active</Typography.Text> : 'Inactive',
              },
              {
                title: 'Actions',
                width: 180,
                render: (_, record) => (
                  <Space>
                    <Button icon={<EditOutlined />} onClick={() => openEditModal(record)}>
                      Edit
                    </Button>
                    <Popconfirm title="Deactivate this criterion?" onConfirm={() => void handleDelete(record.id)}>
                      <Button danger icon={<DeleteOutlined />}>
                        Deactivate
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>

      <Modal
        open={modalOpen}
        title={editingCriterion ? 'Edit Criterion' : 'Create Criterion'}
        onCancel={() => setModalOpen(false)}
        onOk={() => void form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={blankCriterion}>
          <Form.Item name="category_id" label="Category" rules={[{ required: true }]}>
            <Select options={categories.map((category) => ({ value: category.id, label: category.name }))} />
          </Form.Item>
          <Form.Item name="name" label="Criterion Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Rubric Description">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="max_score" label="Maximum Score" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="display_order" label="Display Order" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
