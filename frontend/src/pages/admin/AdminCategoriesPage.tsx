import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
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
import type { Category, CategoryPayload } from '../../types/domain';

export function AdminCategoriesPage() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [form] = Form.useForm<CategoryPayload>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  async function loadCategories() {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      setCategories(await adminApi.getAdminCategories(token));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminCategories.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, [token]);

  function openCreateModal() {
    setEditingCategory(null);
    form.setFieldsValue({ name: '', name_th: '', description: '', description_th: '', is_active: true });
    setModalOpen(true);
  }

  function openEditModal(category: Category) {
    setEditingCategory(category);
    form.setFieldsValue({
      name: category.name,
      name_th: category.name_th,
      description: category.description,
      description_th: category.description_th,
      is_active: category.is_active,
    });
    setModalOpen(true);
  }

  async function handleSubmit(values: CategoryPayload) {
    if (!token) {
      return;
    }

    setSaving(true);
    try {
      if (editingCategory) {
        await adminApi.updateCategory(token, editingCategory.id, values);
      } else {
        await adminApi.createCategory(token, values);
      }
      setModalOpen(false);
      await loadCategories();
      messageApi.success(
        t('adminCategories.savedSuccess', {
          action: editingCategory ? t('adminCategories.updated') : t('adminCategories.created'),
        }),
      );
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminCategories.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) {
      return;
    }
    try {
      await adminApi.deleteCategory(token, id);
      await loadCategories();
      messageApi.success(t('adminCategories.deactivatedSuccess'));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminCategories.deactivateError'));
    }
  }

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card className="soft-card">
          <div className="table-toolbar">
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t('adminCategories.categories')}
            </Typography.Title>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              {t('adminCategories.newCategory')}
            </Button>
          </div>

          <Table<Category>
            rowKey="id"
            loading={loading}
            dataSource={categories}
            pagination={false}
            columns={[
              { title: t('common.name'), dataIndex: 'name' },
              {
                title: t('common.description'),
                dataIndex: 'description',
                render: (value: string) =>
                  value || <Typography.Text type="secondary">{t('common.noDescription')}</Typography.Text>,
              },
              {
                title: t('common.status'),
                dataIndex: 'is_active',
                width: 120,
                render: (value: boolean) =>
                  value ? (
                    <Typography.Text style={{ color: '#4f7a57', whiteSpace: 'nowrap' }}>
                      {t('common.active')}
                    </Typography.Text>
                  ) : (
                    <span style={{ whiteSpace: 'nowrap' }}>{t('common.inactive')}</span>
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
                      title={t('adminCategories.deactivateConfirm')}
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
        title={editingCategory ? t('adminCategories.editTitle') : t('adminCategories.createTitle')}
        onCancel={() => setModalOpen(false)}
        onOk={() => void form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ is_active: true }}>
          <Form.Item name="name" label={t('adminCategories.categoryNameEn')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name_th" label={t('adminCategories.categoryNameTh')}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('adminCategories.descriptionEn')}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="description_th" label={t('adminCategories.descriptionTh')}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="is_active" label={t('common.active')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
