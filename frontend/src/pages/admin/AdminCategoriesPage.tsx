import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Switch,
  Table,
  Typography,
  message,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';

import * as adminApi from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { localize } from '../../locales/localize';
import type { AwardGroup, Category, CategoryPayload } from '../../types/domain';

export function AdminCategoriesPage() {
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const [form] = Form.useForm<CategoryPayload>();
  const [groups, setGroups] = useState<AwardGroup[]>([]);
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
      const [nextGroups, nextCategories] = await Promise.all([
        adminApi.getAdminGroups(token),
        adminApi.getAdminCategories(token),
      ]);
      setGroups(nextGroups);
      setCategories(nextCategories);
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
    form.setFieldsValue({
      award_group_id: undefined,
      name: '',
      name_th: '',
      description: '',
      description_th: '',
      is_active: true,
    });
    setModalOpen(true);
  }

  function openEditModal(category: Category) {
    setEditingCategory(category);
    form.setFieldsValue({
      award_group_id: category.award_group_id,
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

  const sections = useMemo(() => {
    const result: Array<{ group: AwardGroup | null; categories: Category[] }> = [];
    const orderedGroups = [...groups].sort((a, b) => a.display_order - b.display_order);
    const orderedCategories = [...categories].sort((a, b) => a.display_order - b.display_order);

    for (const group of orderedGroups) {
      const groupedCategories = orderedCategories.filter((category) => category.award_group_id === group.id);
      if (groupedCategories.length > 0) {
        result.push({ group, categories: groupedCategories });
      }
    }

    const ungrouped = orderedCategories.filter((category) => !category.award_group_id);
    if (ungrouped.length > 0) {
      result.push({ group: null, categories: ungrouped });
    }

    return result;
  }, [categories, groups]);

  const columns = [
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
      render: (_: unknown, record: Category) => (
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
  ];

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

          {loading ? (
            <div className="full-height-spin" style={{ minHeight: 220 }}>
              <Spin size="large" />
            </div>
          ) : sections.length > 0 ? (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {sections.map((section) => (
                <section className="admin-category-group" key={section.group?.id ?? 'ungrouped'}>
                  <div className="admin-category-group__heading">
                    <div>
                      <Typography.Title level={4} className="admin-category-group__title">
                        {section.group
                          ? localize(language, section.group.name, section.group.name_th)
                          : t('adminResults.ungrouped')}
                      </Typography.Title>
                      {section.group?.description || section.group?.description_th ? (
                        <Typography.Paragraph className="admin-category-group__copy">
                          {localize(language, section.group.description, section.group.description_th)}
                        </Typography.Paragraph>
                      ) : null}
                    </div>
                    <Tag color="orange">{section.categories.length}</Tag>
                  </div>

                  <Table<Category>
                    rowKey="id"
                    dataSource={section.categories}
                    pagination={false}
                    columns={columns}
                  />
                </section>
              ))}
            </Space>
          ) : (
            <Empty description={t('adminCategories.empty')} />
          )}
        </Card>
      </Space>

      <Modal
        open={modalOpen}
        title={editingCategory ? t('adminCategories.editTitle') : t('adminCategories.createTitle')}
        onCancel={() => setModalOpen(false)}
        onOk={() => void form.submit()}
        confirmLoading={saving}
        width={900}
        destroyOnHidden
        className="admin-form-modal"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ is_active: true }}>
          <div className="admin-form-sections">
            <section className="admin-form-section">
              <div className="admin-form-grid">
                <Form.Item name="award_group_id" label={t('adminCategories.awardGroup')}>
                  <Select
                    allowClear
                    placeholder={t('adminCategories.selectAwardGroup')}
                    options={groups.map((group) => ({
                      value: group.id,
                      label: localize(language, group.name, group.name_th),
                    }))}
                  />
                </Form.Item>
                <div />
                <Form.Item name="name" label={t('adminCategories.categoryNameEn')} rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="name_th" label={t('adminCategories.categoryNameTh')}>
                  <Input />
                </Form.Item>
                <Form.Item
                  name="description"
                  label={t('adminCategories.descriptionEn')}
                  className="admin-form-grid__full"
                >
                  <Input.TextArea rows={4} />
                </Form.Item>
                <Form.Item
                  name="description_th"
                  label={t('adminCategories.descriptionTh')}
                  className="admin-form-grid__full"
                >
                  <Input.TextArea rows={4} />
                </Form.Item>
                <Form.Item name="is_active" label={t('common.active')} valuePropName="checked">
                  <Switch />
                </Form.Item>
              </div>
            </section>
          </div>
        </Form>
      </Modal>
    </>
  );
}
