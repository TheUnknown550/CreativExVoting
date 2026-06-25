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
import { useLanguage } from '../../contexts/LanguageContext';
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
  const { t } = useLanguage();
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
      messageApi.error(error instanceof ApiError ? error.message : t('adminCriteria.loadCategoriesError'));
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
      messageApi.error(error instanceof ApiError ? error.message : t('adminCriteria.loadCriteriaError'));
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
      messageApi.success(
        t('adminCriteria.savedSuccess', {
          action: editingCriterion ? t('adminCriteria.updated') : t('adminCriteria.created'),
        }),
      );
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminCriteria.saveError'));
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
      messageApi.success(t('adminCriteria.deactivatedSuccess'));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminCriteria.deactivateError'));
    }
  }

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card className="soft-card">
          <div className="table-toolbar">
            <div className="table-toolbar__filters">
              <Select
                value={selectedCategoryId}
                onChange={(value) => setSelectedCategoryId(value)}
                options={categories.map((category) => ({ value: category.id, label: category.name }))}
                placeholder={t('adminCriteria.selectCategory')}
                style={{ width: 280 }}
              />
            </div>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              {t('adminCriteria.newCriterion')}
            </Button>
          </div>

          <Table<ScoringCriterion>
            rowKey="id"
            loading={loading}
            dataSource={criteria}
            pagination={false}
            columns={[
              { title: t('common.name'), dataIndex: 'name' },
              {
                title: t('common.description'),
                dataIndex: 'description',
                render: (value: string) =>
                  value ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{value}</span>
                  ) : (
                    <Typography.Text type="secondary">{t('common.noDescription')}</Typography.Text>
                  ),
              },
              { title: t('adminCriteria.maxScore'), dataIndex: 'max_score', width: 120 },
              { title: t('adminCriteria.displayOrder'), dataIndex: 'display_order', width: 140 },
              {
                title: t('common.status'),
                dataIndex: 'is_active',
                width: 120,
                render: (value: boolean) =>
                  value ? (
                    <Typography.Text style={{ color: '#4f7a57' }}>{t('common.active')}</Typography.Text>
                  ) : (
                    t('common.inactive')
                  ),
              },
              {
                title: t('common.actions'),
                width: 180,
                render: (_, record) => (
                  <Space>
                    <Button icon={<EditOutlined />} onClick={() => openEditModal(record)}>
                      {t('common.edit')}
                    </Button>
                    <Popconfirm
                      title={t('adminCriteria.deactivateConfirm')}
                      onConfirm={() => void handleDelete(record.id)}
                    >
                      <Button danger icon={<DeleteOutlined />}>
                        {t('common.deactivate')}
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
        title={editingCriterion ? t('adminCriteria.editTitle') : t('adminCriteria.createTitle')}
        onCancel={() => setModalOpen(false)}
        onOk={() => void form.submit()}
        confirmLoading={saving}
        width={920}
        destroyOnHidden
        className="admin-form-modal"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={blankCriterion}>
          <div className="admin-form-sections">
            <section className="admin-form-section">
              <div className="admin-form-grid">
                <Form.Item name="category_id" label={t('adminCriteria.category')} rules={[{ required: true }]}>
                  <Select options={categories.map((category) => ({ value: category.id, label: category.name }))} />
                </Form.Item>
                <Form.Item name="is_active" label={t('common.active')} valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name="name" label={t('adminCriteria.criterionName')} rules={[{ required: true }]} className="admin-form-grid__full">
                  <Input />
                </Form.Item>
                <Form.Item name="description" label={t('adminCriteria.rubricDescription')} className="admin-form-grid__full">
                  <Input.TextArea rows={5} />
                </Form.Item>
                <Form.Item name="max_score" label={t('adminCriteria.maximumScore')} rules={[{ required: true }]}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="display_order" label={t('adminCriteria.displayOrder')} rules={[{ required: true }]}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </div>
            </section>
          </div>
        </Form>
      </Modal>
    </>
  );
}
